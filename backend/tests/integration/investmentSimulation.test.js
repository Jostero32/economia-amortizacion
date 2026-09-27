/**
 * Pruebas de Integración - Simulación de Inversiones (DPF) y Certificado PDF
 * Endpoints:
 * - POST /api/simulations/investments (Público - Sin JWT)
 * - GET /api/simulations/investments/:id
 * - GET /api/simulations/investments/:id/pdf
 */

const request = require('supertest');
const app = require('../../src/app');
const { todayISO, addDays } = require('../../src/utils/dates');
const { InvestmentProduct } = require('../../src/models');
const { initTestDatabase, seedCompleteData, closeTestDatabase } = require('../helpers/dbSetup');

describe('Integración: Simulación de Inversiones y PDF (/api/simulations/investments)', () => {
  let sampleInvProduct;

  beforeAll(async () => {
    await initTestDatabase();
    await seedCompleteData();
    sampleInvProduct = await InvestmentProduct.findOne({ where: { nombre: 'Depósito a Plazo Fijo' } });
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

  test('a 90 días aplica la tasa del tramo 61-90 y retiene el 3 % del interés', async () => {
    const res = await request(app)
      .post('/api/simulations/investments')
      .send({
        investmentProductId: sampleInvProduct.id,
        amount: 15000,
        termDays: 90,
      });

    expect(res.status).toBe(201);
    const sim = res.body.data.simulation;
    // Tramo 61-90 días del seed: 4.40 % -> 15,000 * 0.044 * 90 / 360 = 165.00
    expect(Number(sim.tasaAnual)).toBe(4.4);
    expect(Number(sim.interesGanado)).toBe(165);
    expect(Number(sim.retencionIR)).toBe(4.95);
    expect(Number(sim.interesNeto)).toBe(160.05);
    expect(Number(sim.valorFinal)).toBe(15160.05);
  });

  test('el depósito con pago mensual devuelve el cronograma de pagos', async () => {
    const monthly = await InvestmentProduct.findOne({ where: { nombre: 'Depósito a Plazo con Pago Mensual' } });
    const res = await request(app)
      .post('/api/simulations/investments')
      .send({ investmentProductId: monthly.id, amount: 10000, termDays: 360 });

    expect(res.status).toBe(201);
    const sim = res.body.data.simulation;
    expect(sim.pagoIntereses).toBe('MENSUAL');
    expect(sim.cronogramaPagos).toHaveLength(12);
    expect(res.body.data.product.pagoIntereses).toBe('MENSUAL');

    const pdf = await request(app).get(`/api/simulations/investments/${sim.id}/pdf`);
    expect(pdf.status).toBe(200);
  });

  test('simula un ahorro programado con aportes mensuales y genera su PDF', async () => {
    const savings = await InvestmentProduct.findOne({ where: { nombre: 'Ahorro Programado' } });
    const res = await request(app)
      .post('/api/simulations/investments')
      .send({ investmentProductId: savings.id, amount: 150, termDays: 360 });

    expect(res.status).toBe(201);
    const sim = res.body.data.simulation;
    expect(Number(sim.aporteMensual)).toBe(150);
    expect(Number(sim.monto)).toBe(1800);
    expect(sim.cronogramaPagos).toHaveLength(12);
    expect(Number(sim.valorFinal)).toBeGreaterThan(1800);
    expect(res.body.data.product.tipo).toBe('AHORRO_PROGRAMADO');

    const pdf = await request(app).get(`/api/simulations/investments/${sim.id}/pdf`);
    expect(pdf.status).toBe(200);
  });

  test('el ahorro programado exige meses completos y un aporte dentro de los límites', async () => {
    const savings = await InvestmentProduct.findOne({ where: { nombre: 'Ahorro Programado' } });
    const days = await request(app)
      .post('/api/simulations/investments')
      .send({ investmentProductId: savings.id, amount: 150, termDays: 200 });
    expect(days.status).toBe(400);
    expect(days.body.message).toMatch(/número entero de meses/);

    const amount = await request(app)
      .post('/api/simulations/investments')
      .send({ investmentProductId: savings.id, amount: 5, termDays: 360 });
    expect(amount.status).toBe(400);
    expect(amount.body.message).toMatch(/aporte mensual/);
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

  test('rechaza simulación con fecha de inicio en el pasado (Código 400)', async () => {
    const yesterday = addDays(todayISO(), -1);
    const res = await request(app)
      .post('/api/simulations/investments')
      .send({
        investmentProductId: sampleInvProduct.id,
        amount: 5000,
        termDays: 180,
        startDate: yesterday,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/fecha de apertura no puede ser anterior a hoy/i);
      expect(res.body.errors.startDate).toBeDefined();
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
