/**
 * Pruebas de Integración - Verificación de identidad (eKYC)
 * Endpoints:
 * - GET/POST /api/identity, POST /api/identity/:id/{anverso,reverso,selfie}, GET /api/identity/:id/archivos/:tipo
 * - GET /api/admin/identity-verifications, GET /:id, PATCH /:id/decision
 * - Exigencia de identidad al crear y aprobar solicitudes
 *
 * El reconocimiento facial se simula (descriptores con distancia conocida); el resto es real.
 */
jest.mock('../../src/services/identity/faceService', () => {
  const actual = jest.requireActual('../../src/services/identity/faceService');
  return { ...actual, warmup: jest.fn(), detectMainFace: jest.fn() };
});

const request = require('supertest');
const sharp = require('sharp');
const app = require('../../src/app');
const faceService = require('../../src/services/identity/faceService');
const { CONSENT_VERSION } = require('../../src/config/identity');
const { PENDING_DATA_MOTIVE } = require('../../src/services/identity/decisionEngine');
const { CreditType, Document, User } = require('../../src/models');
const { initTestDatabase, seedCompleteData, generateTestToken } = require('../helpers/dbSetup');

// Rostro simulado: la distancia entre face(a) y face(b) es |a − b|
const face = (value) => ({ descriptor: [value, ...new Array(127).fill(0)], score: 0.9, faces: 1, box: {}, landmarks: [] });

let photo;
let cedulaSeq = 0;
const CEDULAS = ['1712345600', '1712345618', '1712345626', '1712345634', '1712345642', '1712345659'];

async function newClient() {
  const cedula = CEDULAS[cedulaSeq];
  cedulaSeq += 1;
  const user = await User.create({
    nombre: `Cliente Identidad ${cedulaSeq}`,
    email: `identidad${cedulaSeq}@test.local`,
    password: 'Cliente123!',
    rol: 'CLIENTE',
    cedula,
  });
  return { user, token: generateTestToken(user) };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const start = (token, body = { aceptaConsentimiento: true, consentimientoVersion: CONSENT_VERSION }) => request(app)
  .post('/api/identity').set(auth(token)).send(body);
const upload = (token, id, side) => request(app)
  .post(`/api/identity/${id}/${side}`).set(auth(token)).attach('foto', photo, `${side}.jpg`);
const sendSelfie = (token, id) => request(app)
  .post(`/api/identity/${id}/selfie`).set(auth(token)).attach('selfie', photo, 'selfie.jpg');

/** Recorre el flujo hasta la selfie con la distancia indicada entre la cédula y la selfie. */
async function verify(token, distance) {
  const started = await start(token);
  const { id } = started.body.data.verification;
  faceService.detectMainFace.mockResolvedValueOnce(face(0));
  await upload(token, id, 'anverso');
  await upload(token, id, 'reverso');
  faceService.detectMainFace.mockResolvedValueOnce(face(0)).mockResolvedValueOnce(face(distance));
  const res = await sendSelfie(token, id);
  return { id, res };
}

describe('Integración: verificación de identidad (/api/identity)', () => {
  let advisorToken;

  beforeAll(async () => {
    await initTestDatabase();
    await seedCompleteData();
    photo = await sharp({ create: { width: 856, height: 540, channels: 3, background: '#dfe8ef' } }).jpeg().toBuffer();
    const advisor = await User.findOne({ where: { rol: 'ASESOR' } });
    advisorToken = generateTestToken(advisor);
  });

  beforeEach(() => {
    faceService.detectMainFace.mockReset();
  });

  test('un cliente nuevo no está verificado ni puede solicitar', async () => {
    const { token } = await newClient();
    const res = await request(app).get('/api/identity/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ verification: null, verificada: false, puedeSolicitar: false, consentimientoVersion: CONSENT_VERSION });
  });

  test('iniciar exige el consentimiento vigente y reanuda la verificación en curso', async () => {
    const { token } = await newClient();
    expect((await start(token, { aceptaConsentimiento: false, consentimientoVersion: CONSENT_VERSION })).status).toBe(400);
    expect((await start(token, { aceptaConsentimiento: true, consentimientoVersion: '2020-01' })).status).toBe(400);

    const first = await start(token);
    expect(first.status).toBe(201);
    expect(first.body.data.verification.estado).toBe('EN_CURSO');
    const again = await start(token);
    expect(again.body.data.verification.id).toBe(first.body.data.verification.id);
  });

  test('el anverso sin rostro se rechaza para repetir la foto', async () => {
    const { token } = await newClient();
    const { id } = (await start(token)).body.data.verification;
    faceService.detectMainFace.mockResolvedValueOnce(null);
    const res = await upload(token, id, 'anverso');
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/No encontramos la foto de tu cédula/);
  });

  test('la selfie exige antes las dos fotos de la cédula', async () => {
    const { token } = await newClient();
    const { id } = (await start(token)).body.data.verification;
    expect((await sendSelfie(token, id)).status).toBe(400);
  });

  test('el reverso borroso se acepta con una advertencia', async () => {
    const { token } = await newClient();
    const { id } = (await start(token)).body.data.verification;
    const res = await upload(token, id, 'reverso');
    expect(res.status).toBe(200);
    expect(res.body.data.verification.capturas.reverso).toBe(true);
    expect(res.body.data.advertencia).toMatch(/borrosa/);
  });

  test('con el rostro coincidente (fase 1) la verificación pasa al asesor', async () => {
    const { token } = await newClient();
    const { res } = await verify(token, 0.3);
    expect(res.status).toBe(200);
    expect(res.body.data.resultado).toBe('EN_REVISION');
    const { verification } = res.body.data;
    expect(verification.estado).toBe('EN_REVISION');
    expect(verification.rostro.resultado).toBe('COINCIDE');
    expect(verification.motivos).toEqual([PENDING_DATA_MOTIVE]);
    expect(verification.controles.map((c) => c.codigo)).toEqual(['ROSTRO_CEDULA', 'ROSTRO_SELFIE', 'ROSTRO_COINCIDE']);

    // Ya no admite cambios, pero con la identidad en revisión el cliente puede solicitar
    expect((await upload(token, verification.id, 'reverso')).status).toBe(400);
    const me = await request(app).get('/api/identity/me').set(auth(token));
    expect(me.body.data).toMatchObject({ verificada: false, puedeSolicitar: true });
  });

  test('con el rostro dudoso pasa al asesor con el motivo', async () => {
    const { token } = await newClient();
    const { res } = await verify(token, 0.55);
    expect(res.body.data.resultado).toBe('EN_REVISION');
    expect(res.body.data.verification.motivos[0]).toMatch(/no es concluyente/);
  });

  test('con el rostro distinto pide reintentar y, al tercer intento, pasa al asesor', async () => {
    const { token } = await newClient();
    const first = await verify(token, 0.9);
    expect(first.res.body.data.resultado).toBe('REINTENTAR');
    expect(first.res.body.data.verification).toMatchObject({ estado: 'EN_CURSO', intentos: 1, intentosRestantes: 2 });

    const second = await verify(token, 0.9);
    expect(second.id).toBe(first.id);
    expect(second.res.body.data.resultado).toBe('REINTENTAR');

    const third = await verify(token, 0.9);
    expect(third.res.body.data.resultado).toBe('EN_REVISION');
    expect(third.res.body.data.verification.motivos.join(' ')).toMatch(/Se agotaron los 3 intentos/);
  });

  test('las imágenes solo las ven el titular y el personal', async () => {
    const owner = await newClient();
    const other = await newClient();
    const { id } = await verify(owner.token, 0.3);

    const mine = await request(app).get(`/api/identity/${id}/archivos/anverso`).set(auth(owner.token));
    expect(mine.status).toBe(200);
    expect(mine.headers['content-type']).toContain('image/jpeg');
    expect((await request(app).get(`/api/identity/${id}/archivos/selfie`).set(auth(advisorToken))).status).toBe(200);
    expect((await request(app).get(`/api/identity/${id}/archivos/anverso`).set(auth(other.token))).status).toBe(403);
    expect((await request(app).get(`/api/identity/${id}/archivos/pasaporte`).set(auth(owner.token))).status).toBe(400);
    expect((await request(app).get('/api/identity/no-es-un-id/archivos/anverso').set(auth(owner.token))).status).toBe(404);
    // Las capturas no se publican como archivos estáticos
    expect((await request(app).get('/uploads/documentos/identidad/')).status).toBe(404);
  });

  describe('decisión del asesor', () => {
    test('la cola muestra las verificaciones en revisión y solo el personal la ve', async () => {
      const { token } = await newClient();
      const { id } = await verify(token, 0.3);

      const res = await request(app).get('/api/admin/identity-verifications?estado=EN_REVISION').set(auth(advisorToken));
      expect(res.status).toBe(200);
      expect(res.body.data.verifications.map((v) => v.id)).toContain(id);
      expect(res.body.data.counts.EN_REVISION).toBeGreaterThan(0);
      expect((await request(app).get('/api/admin/identity-verifications').set(auth(token))).status).toBe(403);

      const detail = await request(app).get(`/api/admin/identity-verifications/${id}`).set(auth(advisorToken));
      expect(detail.status).toBe(200);
      expect(detail.body.data.verification.rostroDistancia).toBeCloseTo(0.3, 4);
      expect(detail.body.data.verification.user.cedula).toBeDefined();
      expect(detail.body.data.verification.consentimiento.version).toBe(CONSENT_VERSION);
    });

    test('rechazar exige el motivo; tras el rechazo el cliente puede empezar de nuevo', async () => {
      const { token } = await newClient();
      const { id } = await verify(token, 0.3);
      const decide = (body) => request(app).patch(`/api/admin/identity-verifications/${id}/decision`).set(auth(advisorToken)).send(body);

      expect((await decide({ estado: 'RECHAZADA' })).status).toBe(400);
      const rejected = await decide({ estado: 'RECHAZADA', comentario: 'La selfie no corresponde a la cédula.' });
      expect(rejected.status).toBe(200);
      expect((await decide({ estado: 'APROBADA' })).status).toBe(400);

      const me = await request(app).get('/api/identity/me').set(auth(token));
      expect(me.body.data.verification.estado).toBe('RECHAZADA');
      expect(me.body.data.verification.comentarioRevision).toBe('La selfie no corresponde a la cédula.');
      const restarted = await start(token);
      expect(restarted.status).toBe(201);
      expect(restarted.body.data.verification.id).not.toBe(id);
    });

    test('aprobar deja la identidad verificada y no permite iniciar otra', async () => {
      const { token } = await newClient();
      const { id } = await verify(token, 0.3);
      const res = await request(app)
        .patch(`/api/admin/identity-verifications/${id}/decision`)
        .set(auth(advisorToken))
        .send({ estado: 'APROBADA' });
      expect(res.status).toBe(200);
      expect(res.body.data.verification).toMatchObject({ estado: 'APROBADA', aprobacionAutomatica: false });

      const me = await request(app).get('/api/identity/me').set(auth(token));
      expect(me.body.data).toMatchObject({ verificada: true, puedeSolicitar: true });
      expect((await start(token)).status).toBe(409);
    });
  });

  describe('exigencia en las solicitudes', () => {
    let creditProduct;
    const creditPayload = () => ({
      creditTypeId: creditProduct.id,
      monto: 5000,
      plazoMeses: 12,
      sistemaAmortizacion: 'FRANCES',
      nombres: 'Carlos',
      apellidos: 'Mendoza',
      cedula: '1723456784',
      direccion: 'Av. 10 de Agosto y Colón',
      ciudad: 'Quito',
      telefono: '0998877665',
      email: 'carlos@cliente.local',
      fechaNacimiento: '1990-05-15',
      actividadEconomica: 'Empleado privado',
      ingresosMensuales: 1500,
      egresosMensuales: 600,
      autorizaConsultaBuro: true,
    });

    beforeAll(async () => {
      creditProduct = await CreditType.findOne({ where: { nombre: 'Crédito de Consumo' } });
    });

    test('sin verificación no se puede solicitar', async () => {
      const { token } = await newClient();
      const res = await request(app).post('/api/credit-applications').set(auth(token)).send(creditPayload());
      expect(res.status).toBe(403);
      expect(res.body.errors.identidad).toBe('IDENTIDAD_NO_VERIFICADA');
    });

    test('con la identidad en revisión se solicita, pero se aprueba solo con la identidad verificada', async () => {
      const { token } = await newClient();
      const { id } = await verify(token, 0.3);

      const created = await request(app).post('/api/credit-applications').set(auth(token)).send(creditPayload());
      expect(created.status).toBe(201);
      const application = created.body.data.application;

      const detail = await request(app).get(`/api/admin/applications/${application.id}`).set(auth(advisorToken));
      expect(detail.body.data.identidad).toMatchObject({ id, estado: 'EN_REVISION', verificada: false });

      await Promise.all(['COMPROBANTE_DOMICILIO', 'COMPROBANTE_INGRESOS'].map((tipo) => Document.create({
        creditApplicationId: application.id,
        tipo,
        nombreArchivo: `${tipo}.pdf`,
        ruta: `${tipo}-identidad-test.pdf`,
        mimeType: 'application/pdf',
        tamano: 1024,
        estado: 'VALIDADO',
      })));
      const status = (body) => request(app).patch(`/api/admin/applications/${application.id}/status`).set(auth(advisorToken)).send(body);
      expect((await status({ estado: 'EN_REVISION' })).status).toBe(200);

      // La casilla anterior de biometría ya no reemplaza a la verificación de identidad
      const blocked = await status({ estado: 'APROBADA', biometriaValidada: true });
      expect(blocked.status).toBe(400);
      expect(blocked.body.message).toMatch(/identidad del cliente no está verificada/);

      await request(app).patch(`/api/admin/identity-verifications/${id}/decision`).set(auth(advisorToken)).send({ estado: 'APROBADA' });
      const approved = await status({ estado: 'APROBADA' });
      expect(approved.status).toBe(200);
      expect(approved.body.data.application.estado).toBe('APROBADA');
    });
  });
});
