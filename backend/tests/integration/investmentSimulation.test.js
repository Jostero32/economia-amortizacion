/**
 * Pruebas de Integración - Simulación de Inversiones (DPF) y Certificado PDF
 * Endpoints:
 * - POST /api/simulations/investments (Público - Sin JWT)
 * - GET /api/simulations/investments/:id
 * - GET /api/simulations/investments/:id/pdf
 */

const request = require('supertest');
const app = require('../../src/app');
const { InvestmentProduct } = require('../../src/models');
const { initTestDatabase, seedCompleteData, closeTestDatabase } = require('../helpers/dbSetup');

describe('Integración: Simulación de Inversiones y PDF (/api/simulations/investments)', () => {
  let sampleInvProduct;

  beforeAll(async () => {
    await initTestDatabase();
    await seedCompleteData();
    sampleInvProduct = await InvestmentProduct.findOne({ where: { activo: true } });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('POST /api/simulations/investments permite a un usuario público simular rendimiento sin autenticación', async () => {
    const res = await request(app)
      .post('/api/simulations/investments')
      .send({
        investmentProductId: sampleInvProduct.id,
        amount: 10000,
        termDays: 360,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.simulation).toBeDefined();

    const sim = res.body.data.simulation;
    expect(sim.id).toBeDefined();
    expect(Number(sim.monto)).toBe(10000);
    expect(sim.plazoDias).toBe(360);
    expect(Number(sim.interesGanado)).toBeGreaterThan(0);
    expect(Number(sim.valorFinal)).toBe(Number(sim.monto) + Number(sim.interesGanado));
  });

  test('rechaza simulación con monto menor al mínimo del producto de inversión (Código 400)', async () => {
    const res = await request(app)
      .post('/api/simulations/investments')
      .send({
        investmentProductId: sampleInvProduct.id,
        amount: 50, // Menor al mínimo
        termDays: 180,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('rechaza simulación con plazo fuera de los límites del producto (Código 400)', async () => {
    const res = await request(app)
      .post('/api/simulations/investments')
      .send({
        investmentProductId: sampleInvProduct.id,
        amount: 5000,
        termDays: 15, // Menor a plazoMinimoDias
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/simulations/investments/:id recupera los datos de la inversión calculada', async () => {
    const simRes = await request(app)
      .post('/api/simulations/investments')
      .send({
        investmentProductId: sampleInvProduct.id,
        amount: 15000,
        termDays: 180,
      });

    const simId = simRes.body.data.simulation.id;

    const res = await request(app).get(`/api/simulations/investments/${simId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.simulation.id).toBe(simId);
    expect(Number(res.body.data.simulation.monto)).toBe(15000);
  });

  test('GET /api/simulations/investments/:id/pdf genera un certificado de inversión en formato PDF válido', async () => {
    const simRes = await request(app)
      .post('/api/simulations/investments')
      .send({
        investmentProductId: sampleInvProduct.id,
        amount: 20000,
        termDays: 360,
      });

    const simId = simRes.body.data.simulation.id;

    const res = await request(app)
      .get(`/api/simulations/investments/${simId}/pdf`)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/i);
    expect(res.body).toBeDefined();
    expect(Buffer.byteLength(res.body)).toBeGreaterThan(500);
  });
});
