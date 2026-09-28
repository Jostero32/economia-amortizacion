const request = require('supertest');
const app = require('../../src/app');
const { IdentityVerification, User } = require('../../src/models');
const { CONSENT_VERSION } = require('../../src/config/identity');
const { initTestDatabase, seedCompleteData, generateTestToken } = require('../helpers/dbSetup');

describe('Integración: métricas de identidad', () => {
  let client;
  let advisor;
  let admin;
  const get = (user) => request(app).get('/api/admin/identity-verifications/metrics')
    .set('Authorization', `Bearer ${generateTestToken(user)}`);
  const create = (changes = {}) => IdentityVerification.create({
    userId: client.id,
    consentimientoVersion: CONSENT_VERSION,
    consentimientoFecha: new Date('2026-09-01T00:00:00Z'),
    createdAt: new Date('2026-09-01T00:00:00Z'),
    ...changes,
  });

  beforeAll(async () => {
    await initTestDatabase();
    await seedCompleteData();
    client = await User.findOne({ where: { rol: 'CLIENTE' } });
    advisor = await User.findOne({ where: { rol: 'ASESOR' } });
    admin = await User.findOne({ where: { rol: 'ADMIN' } });
  });
  beforeEach(async () => { await IdentityVerification.destroy({ where: {} }); });

  test('solo asesor y administrador pueden consultar; metrics no se interpreta como UUID', async () => {
    expect((await request(app).get('/api/admin/identity-verifications/metrics')).status).toBe(401);
    expect((await get(client)).status).toBe(403);
    expect((await get(advisor)).status).toBe(200);
    expect((await get(admin)).status).toBe(200);
  });

  test('sin verificaciones devuelve ceros y tiempo de revisión sin datos', async () => {
    const { body } = await get(advisor);
    expect(body.data).toMatchObject({
      total: 0, porEstado: { EN_CURSO: 0, EN_REVISION: 0, APROBADA: 0, RECHAZADA: 0 },
      aprobadasAutomaticas: 0, porcentajeAutomatico: 0, tiposCedula: { ELECTRONICA: 0, ANTIGUA: 0 },
      motivosFrecuentes: [], tiempoPromedioRevisionHoras: null,
    });
    expect(body.data.distanciasAprobadas.map((r) => r.cantidad)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  test('cuenta estados y tipos, divide automáticas entre aprobadas y promedia solo revisiones del asesor', async () => {
    await create({ estado: 'APROBADA', aprobacionAutomatica: true, tipoCedula: 'ELECTRONICA', rostroDistancia: 0.3 });
    await create({ estado: 'APROBADA', aprobacionAutomatica: true, tipoCedula: 'ELECTRONICA', rostroDistancia: 0.4 });
    await create({ estado: 'APROBADA', tipoCedula: 'ANTIGUA', rostroDistancia: 0.6, revisadoPor: advisor.id, fechaRevision: new Date('2026-09-01T04:00:00Z') });
    await create({ estado: 'EN_REVISION', tipoCedula: 'ELECTRONICA', motivos: ['Sin prueba de vida', 'Dato pendiente'] });
    await create({ estado: 'RECHAZADA', tipoCedula: 'ANTIGUA', motivos: ['Sin prueba de vida', 'Sin prueba de vida'], revisadoPor: advisor.id, fechaRevision: new Date('2026-09-01T02:00:00Z') });
    await create({ estado: 'EN_CURSO' });
    const { body } = await get(advisor);
    expect(body.data).toMatchObject({
      total: 6, porEstado: { EN_CURSO: 1, EN_REVISION: 1, APROBADA: 3, RECHAZADA: 1 },
      aprobadasAutomaticas: 2, porcentajeAutomatico: 66.67,
      tiposCedula: { ELECTRONICA: 3, ANTIGUA: 2 }, tiempoPromedioRevisionHoras: 3,
      motivosFrecuentes: [{ motivo: 'Sin prueba de vida', cantidad: 2 }, { motivo: 'Dato pendiente', cantidad: 1 }],
    });
    expect(body.data.distanciasAprobadas.map((r) => r.cantidad)).toEqual([1, 1, 0, 0, 0, 1]);
    expect(JSON.stringify(body.data)).not.toMatch(/userId|selfieRuta|datosMrz|consentimientoIp/);
  });

  test('los límites de los tramos no se duplican y se omiten distancias ausentes o fuera del rango', async () => {
    for (const rostroDistancia of [0, 0.3, 0.3001, 0.4, 0.4001, 0.45, 0.4501, 0.5, 0.5001, 0.55, 0.5501, 0.6, null, -0.1, 0.7]) {
      await create({ estado: 'APROBADA', rostroDistancia });
    }
    await create({ estado: 'EN_REVISION', rostroDistancia: 0.3 });
    const { body } = await get(advisor);
    expect(body.data.distanciasAprobadas).toHaveLength(6);
    expect(body.data.distanciasAprobadas.map((r) => r.cantidad)).toEqual([2, 2, 2, 2, 2, 2]);
  });

  test('devuelve cinco motivos, cuenta cada motivo una vez por caso e ignora estados resueltos sin rechazo', async () => {
    for (let index = 1; index <= 7; index += 1) {
      await create({ estado: 'EN_REVISION', motivos: ['Motivo común', `Motivo ${index}`, '', 'Motivo común'] });
    }
    await create({ estado: 'APROBADA', motivos: ['No debe aparecer'] });
    const { body } = await get(advisor);
    expect(body.data.motivosFrecuentes).toHaveLength(5);
    expect(body.data.motivosFrecuentes[0]).toEqual({ motivo: 'Motivo común', cantidad: 7 });
    expect(body.data.motivosFrecuentes.some((r) => r.motivo === 'No debe aparecer')).toBe(false);
    expect(body.data.porcentajeAutomatico).toBe(0);
  });
});
