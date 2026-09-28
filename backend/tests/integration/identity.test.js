/**
 * Pruebas de Integración - Verificación de identidad (eKYC)
 * Endpoints:
 * - GET/POST /api/identity, POST /api/identity/:id/{anverso,reverso,selfie}, GET /api/identity/:id/archivos/:tipo
 * - GET /api/admin/identity-verifications, GET /:id, PATCH /:id/decision
 * - Exigencia de identidad al crear y aprobar solicitudes
 *
 * El reconocimiento facial y la lectura de la MRZ se simulan; reglas, datos y archivos son reales.
 */
jest.mock('../../src/services/identity/faceService', () => {
  const actual = jest.requireActual('../../src/services/identity/faceService');
  return { ...actual, warmup: jest.fn(), detectMainFace: jest.fn() };
});
jest.mock('../../src/services/identity/mrzService', () => {
  const actual = jest.requireActual('../../src/services/identity/mrzService');
  return { ...actual, readMrz: jest.fn() };
});

const request = require('supertest');
const sharp = require('sharp');
const app = require('../../src/app');
const faceService = require('../../src/services/identity/faceService');
const mrzService = require('../../src/services/identity/mrzService');
const { CONSENT_VERSION } = require('../../src/config/identity');
const { CreditType, Document, IdentityVerification, User } = require('../../src/models');
const { initTestDatabase, seedCompleteData, generateTestToken } = require('../helpers/dbSetup');
const { face } = require('../helpers/livenessFixtures');

let photo;
let seq = 0;

/** Cédula válida y única para la prueba n (provincia 17, dígito verificador módulo 10). */
function cedulaFor(n) {
  const base = `171${String(n).padStart(6, '0')}`;
  const sum = [2, 1, 2, 1, 2, 1, 2, 1, 2].reduce((total, coefficient, i) => {
    const product = Number(base[i]) * coefficient;
    return total + (product > 9 ? product - 9 : product);
  }, 0);
  return `${base}${(10 - (sum % 10)) % 10}`;
}

async function newClient({ cedula } = {}) {
  seq += 1;
  const user = await User.create({
    nombre: `Cliente Identidad ${seq}`,
    email: `identidad${seq}@test.local`,
    password: 'Cliente123!',
    rol: 'CLIENTE',
    cedula: cedula === undefined ? cedulaFor(seq) : cedula,
  });
  return { user, token: generateTestToken(user) };
}

/** Lectura de la MRZ coherente con el cliente (su cédula y su nombre), con cambios opcionales. */
const mrzFor = (user, changes = {}) => ({
  leida: true,
  consenso: true,
  intentos: 2,
  datos: {
    nui: user.cedula || cedulaFor(500000 + seq),
    numeroDocumento: '123456789',
    apellidos: 'IDENTIDAD',
    nombres: 'CLIENTE',
    fechaNacimiento: '1990-05-15',
    fechaVencimiento: '2033-09-29',
    sexo: 'F',
    nacionalidad: 'ECU',
    donante: true,
    lineaNombres: 'IDENTIDAD<<CLIENTE<<<<<<<<<<<<',
    ...changes,
  },
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const start = (token, body = { aceptaConsentimiento: true, consentimientoVersion: CONSENT_VERSION }) => request(app)
  .post('/api/identity').set(auth(token)).send(body);
const upload = (token, id, side, fields = {}) => {
  const req = request(app).post(`/api/identity/${id}/${side}`).set(auth(token));
  Object.entries(fields).forEach(([name, value]) => req.field(name, value));
  return req.attach('foto', photo, `${side}.jpg`);
};
const sendSelfie = (token, id, frames = 0) => {
  const req = request(app).post(`/api/identity/${id}/selfie`).set(auth(token)).attach('selfie', photo, 'selfie.jpg');
  for (let i = 0; i < frames; i += 1) req.attach('vida', photo, `vida-${i + 1}.jpg`);
  return req;
};

/**
 * Recorre el flujo hasta la selfie.
 * @param {Object} client - { user, token }
 * @param {number} distance - Distancia entre el rostro de la cédula y el de la selfie
 * @param {Object} [options] - mrz: cambios en los datos leídos · antigua: cédula del modelo anterior
 */
async function verify(client, distance, { mrz = {}, antigua = false, vida = true, cumple = true, otraPersona = false } = {}) {
  const started = await start(client.token);
  const { id, retos } = started.body.data.verification;
  faceService.detectMainFace.mockResolvedValueOnce(face(0));
  await upload(client.token, id, 'anverso');
  if (antigua) {
    await upload(client.token, id, 'reverso', { modeloAnterior: 'true' });
  } else {
    mrzService.readMrz.mockResolvedValueOnce(mrzFor(client.user, mrz));
    await upload(client.token, id, 'reverso');
  }
  faceService.detectMainFace.mockResolvedValueOnce(face(0)).mockResolvedValueOnce(face(distance));
  if (vida) retos.forEach((reto) => faceService.detectMainFace.mockResolvedValueOnce(face(otraPersona ? distance + 0.9 : distance, cumple ? reto : undefined)));
  const res = await sendSelfie(client.token, id, vida ? retos.length : 0);
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
    mrzService.readMrz.mockReset();
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
    expect(first.body.data.verification.retos).toHaveLength(2);
    expect(new Set(first.body.data.verification.retos).size).toBe(2);
    expect(first.body.data.verification.umbralesVida).toEqual({ giro: 0.15, sonrisa: 0.08 });
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

  test('el reverso ilegible pide repetir la foto; con la cédula del modelo anterior continúa', async () => {
    const { user, token } = await newClient();
    const { id } = (await start(token)).body.data.verification;

    mrzService.readMrz.mockResolvedValueOnce({ leida: false, intentos: 7 });
    const unreadable = await upload(token, id, 'reverso');
    expect(unreadable.status).toBe(422);
    expect(unreadable.body.errors.mrz).toBe('ILEGIBLE');
    // La lectura aprovecha la cédula registrada para aceptar una sola lectura coincidente
    expect(mrzService.readMrz).toHaveBeenCalledWith(expect.any(Buffer), { expectedNui: user.cedula });

    const old = await upload(token, id, 'reverso', { modeloAnterior: 'true' });
    expect(old.status).toBe(200);
    expect(old.body.data.verification).toMatchObject({ tipoCedula: 'ANTIGUA', capturas: { reverso: true } });
    expect(mrzService.readMrz).toHaveBeenCalledTimes(1);
  });

  test('con el rostro y los datos coincidentes, la identidad se aprueba automáticamente', async () => {
    const client = await newClient();
    const { res } = await verify(client, 0.3);
    expect(res.status).toBe(200);
    expect(res.body.data.resultado).toBe('APROBADA');
    const { verification } = res.body.data;
    expect(verification).toMatchObject({ estado: 'APROBADA', aprobacionAutomatica: true, motivos: [], vigenteHasta: '2033-09-29' });
    expect(verification.controles.every((c) => c.ok)).toBe(true);
    expect(verification.datos).toMatchObject({ cedula: client.user.cedula, fechaNacimiento: '1990-05-15' });

    const me = await request(app).get('/api/identity/me').set(auth(client.token));
    expect(me.body.data).toMatchObject({ verificada: true, puedeSolicitar: true });
  });

  test('sin fotogramas de vida pasa al asesor aunque rostro y datos coincidan', async () => {
    const { res, id } = await verify(await newClient(), 0.3, { vida: false });
    expect(res.body.data.resultado).toBe('EN_REVISION');
    expect(res.body.data.verification.controles).toContainEqual(expect.objectContaining({ codigo: 'VIDA', ok: null }));
    const saved = await IdentityVerification.findByPk(id);
    expect(saved.vidaRutas).toEqual([]);
    expect(saved.vida.superada).toBeNull();
  });

  test('sin movimiento pide reintentar y al agotar tres intentos pasa al asesor', async () => {
    const client = await newClient();
    for (let intento = 1; intento <= 3; intento += 1) {
      const { res } = await verify(client, 0.3, { cumple: false });
      expect(res.body.data.resultado).toBe(intento < 3 ? 'REINTENTAR' : 'EN_REVISION');
      expect(res.body.data.verification.controles).toContainEqual(expect.objectContaining({ codigo: 'VIDA', ok: false }));
    }
  });

  test('otra persona en los fotogramas obliga a reintentar', async () => {
    const { res } = await verify(await newClient(), 0.3, { otraPersona: true });
    expect(res.body.data.resultado).toBe('REINTENTAR');
    expect(res.body.data.verification.motivos.join(' ')).toMatch(/no coincide con el de tu selfie/);
  });

  test('guarda los retos evaluados y protege las capturas de vida', async () => {
    const owner = await newClient();
    const other = await newClient();
    const { id } = await verify(owner, 0.3);
    const detail = await request(app).get(`/api/admin/identity-verifications/${id}`).set(auth(advisorToken));
    expect(detail.body.data.verification).toMatchObject({ vidaCapturas: 2, vida: { superada: true } });
    expect(detail.body.data.verification.vida.resultados.every((r) => r.ok)).toBe(true);
    expect((await request(app).get(`/api/identity/${id}/archivos/vida-1`).set(auth(owner.token))).status).toBe(200);
    expect((await request(app).get(`/api/identity/${id}/archivos/vida-2`).set(auth(advisorToken))).status).toBe(200);
    expect((await request(app).get(`/api/identity/${id}/archivos/vida-1`).set(auth(other.token))).status).toBe(403);
    expect((await request(app).get(`/api/identity/${id}/archivos/vida-3`).set(auth(owner.token))).status).toBe(404);
  });

  test('sin cédula registrada, la aprobación registra en la cuenta la cédula leída', async () => {
    const client = await newClient({ cedula: null });
    const { res } = await verify(client, 0.3, { mrz: { nui: cedulaFor(900001) } });
    expect(res.body.data.resultado).toBe('APROBADA');
    await client.user.reload();
    expect(client.user.cedula).toBe(cedulaFor(900001));
  });

  test('con la cédula del modelo anterior, la verificación pasa al asesor', async () => {
    const client = await newClient();
    const { res } = await verify(client, 0.3, { antigua: true });
    expect(res.body.data.resultado).toBe('EN_REVISION');
    expect(res.body.data.verification.motivos[0]).toMatch(/modelo anterior/);
  });

  test('una cédula distinta a la registrada pasa al asesor', async () => {
    const client = await newClient();
    const { res } = await verify(client, 0.3, { mrz: { nui: cedulaFor(900002) } });
    expect(res.body.data.resultado).toBe('EN_REVISION');
    expect(res.body.data.verification.motivos.join(' ')).toMatch(/no coincide con el de tu cuenta/);
  });

  test('una cédula que ya es de otra cuenta pasa al asesor', async () => {
    const owner = await newClient();
    const other = await newClient({ cedula: null });
    const { res } = await verify(other, 0.3, { mrz: { nui: owner.user.cedula } });
    expect(res.body.data.resultado).toBe('EN_REVISION');
    expect(res.body.data.verification.motivos).toContain('Esta cédula ya está registrada en otra cuenta.');
  });

  test('un nombre que no coincide pasa al asesor', async () => {
    const client = await newClient();
    const { res } = await verify(client, 0.3, { mrz: { apellidos: 'OTRA PERSONA', nombres: 'LUIS' } });
    expect(res.body.data.resultado).toBe('EN_REVISION');
    expect(res.body.data.verification.motivos[0]).toMatch(/nombre registrado no coincide/);
  });

  test('una cédula vencida se rechaza', async () => {
    const client = await newClient();
    const { res } = await verify(client, 0.3, { mrz: { fechaVencimiento: '2024-01-31' } });
    expect(res.body.data.resultado).toBe('RECHAZADA');
    expect(res.body.data.verification.motivos[0]).toMatch(/venció el 31\/01\/2024/);
  });

  test('con el rostro dudoso pasa al asesor con el motivo', async () => {
    const client = await newClient();
    const { res } = await verify(client, 0.55);
    expect(res.body.data.resultado).toBe('EN_REVISION');
    expect(res.body.data.verification.motivos[0]).toMatch(/no es concluyente/);
  });

  test('con el rostro distinto pide reintentar y, al tercer intento, pasa al asesor', async () => {
    const client = await newClient();
    const first = await verify(client, 0.9);
    expect(first.res.body.data.resultado).toBe('REINTENTAR');
    expect(first.res.body.data.verification).toMatchObject({ estado: 'EN_CURSO', intentos: 1, intentosRestantes: 2 });

    const second = await verify(client, 0.9);
    expect(second.id).toBe(first.id);
    expect(second.res.body.data.resultado).toBe('REINTENTAR');

    const third = await verify(client, 0.9);
    expect(third.res.body.data.resultado).toBe('EN_REVISION');
    expect(third.res.body.data.verification.motivos.join(' ')).toMatch(/Se agotaron los 3 intentos/);
  });

  test('las imágenes solo las ven el titular y el personal', async () => {
    const owner = await newClient();
    const other = await newClient();
    const { id } = await verify(owner, 0.3);

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
      const client = await newClient();
      const { id } = await verify(client, 0.55);

      const res = await request(app).get('/api/admin/identity-verifications?estado=EN_REVISION').set(auth(advisorToken));
      expect(res.status).toBe(200);
      expect(res.body.data.verifications.map((v) => v.id)).toContain(id);
      expect(res.body.data.counts.EN_REVISION).toBeGreaterThan(0);
      expect((await request(app).get('/api/admin/identity-verifications').set(auth(client.token))).status).toBe(403);

      const detail = await request(app).get(`/api/admin/identity-verifications/${id}`).set(auth(advisorToken));
      expect(detail.status).toBe(200);
      expect(detail.body.data.verification.rostroDistancia).toBeCloseTo(0.55, 4);
      expect(detail.body.data.verification.datosMrz.nui).toBe(client.user.cedula);
      expect(detail.body.data.verification.consentimiento.version).toBe(CONSENT_VERSION);
      expect(detail.body.data.umbrales).toEqual({ rostroCoincide: 0.5, rostroDudoso: 0.6 });
    });

    test('rechazar exige el motivo; tras el rechazo el cliente puede empezar de nuevo', async () => {
      const client = await newClient();
      const { id } = await verify(client, 0.55);
      const decide = (body) => request(app).patch(`/api/admin/identity-verifications/${id}/decision`).set(auth(advisorToken)).send(body);

      expect((await decide({ estado: 'RECHAZADA' })).status).toBe(400);
      const rejected = await decide({ estado: 'RECHAZADA', comentario: 'La selfie no corresponde a la cédula.' });
      expect(rejected.status).toBe(200);
      expect((await decide({ estado: 'APROBADA' })).status).toBe(400);

      const me = await request(app).get('/api/identity/me').set(auth(client.token));
      expect(me.body.data.verification.estado).toBe('RECHAZADA');
      expect(me.body.data.verification.comentarioRevision).toBe('La selfie no corresponde a la cédula.');
      const restarted = await start(client.token);
      expect(restarted.status).toBe(201);
      expect(restarted.body.data.verification.id).not.toBe(id);
    });

    test('aprobar deja la identidad verificada con la vigencia de la cédula y no permite iniciar otra', async () => {
      const client = await newClient({ cedula: null });
      const { id } = await verify(client, 0.55, { mrz: { nui: cedulaFor(900003) } });
      const res = await request(app)
        .patch(`/api/admin/identity-verifications/${id}/decision`)
        .set(auth(advisorToken))
        .send({ estado: 'APROBADA' });
      expect(res.status).toBe(200);
      expect(res.body.data.verification).toMatchObject({ estado: 'APROBADA', aprobacionAutomatica: false, vigenteHasta: '2033-09-29' });
      await client.user.reload();
      expect(client.user.cedula).toBe(cedulaFor(900003));

      const me = await request(app).get('/api/identity/me').set(auth(client.token));
      expect(me.body.data).toMatchObject({ verificada: true, puedeSolicitar: true });
      expect((await start(client.token)).status).toBe(409);
    });

    test('una verificación aprobada con la cédula vencida deja de contar', async () => {
      const client = await newClient();
      const { id } = await verify(client, 0.3);
      await IdentityVerification.update({ vigenteHasta: '2020-01-01' }, { where: { id } });
      const me = await request(app).get('/api/identity/me').set(auth(client.token));
      expect(me.body.data).toMatchObject({ verificada: false, puedeSolicitar: false });
      expect((await start(client.token)).status).toBe(201);
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
      fechaNacimiento: '1985-02-20',
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

    test('con la identidad verificada, la solicitud usa la cédula y la fecha de nacimiento verificadas', async () => {
      const client = await newClient();
      await verify(client, 0.3);
      const res = await request(app).post('/api/credit-applications').set(auth(client.token)).send(creditPayload());
      expect(res.status).toBe(201);
      expect(res.body.data.application).toMatchObject({ cedula: client.user.cedula, fechaNacimiento: '1990-05-15' });
    });

    test('con la identidad en revisión se solicita, pero se aprueba solo con la identidad verificada', async () => {
      const client = await newClient();
      const { id } = await verify(client, 0.55);

      const created = await request(app).post('/api/credit-applications').set(auth(client.token)).send(creditPayload());
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
