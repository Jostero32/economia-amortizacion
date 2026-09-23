/**
 * Pruebas de Integración - API de Simulación de Créditos y Exportación PDF
 * Endpoints:
 * - POST /api/simulations/credits (Público - Sin JWT)
 * - POST /api/simulations/credit (Alias)
 * - GET /api/simulations/credits/:id
 * - GET /api/simulations/credits/:id/pdf (Generación de PDF con PDFKit)
 */

const request = require('supertest');
const app = require('../../src/app');
const { CreditType } = require('../../src/models');
const { initTestDatabase, cleanDatabase, seedCompleteData, closeTestDatabase } = require('../helpers/dbSetup');
const { expectCloseToMoney } = require('../helpers/assertions');

describe('Integración: Simulación de Créditos Pública y PDF (/api/simulations/credits)', () => {
  let creditoConsumo;

  beforeAll(async () => {
    await initTestDatabase();
    await seedCompleteData();
    creditoConsumo = await CreditType.findOne({ where: { nombre: 'Crédito de Consumo' } });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // =========================================================================
  // SECCIÓN 18 Y 19: SIMULACIÓN PÚBLICA (SIN EXIGIR LOGIN NI TOKEN JWT)
  // =========================================================================
  describe('Acceso Público y Estructura de Respuesta (Sin Autenticación)', () => {
    test('un usuario anónimo (sin header Authorization ni cookie) puede simular un crédito exitosamente', async () => {
      const payload = {
        creditTypeId: creditoConsumo.id,
        amount: 10000,
        termMonths: 12,
        amortizationSystem: 'FRANCES',
      };

      const res = await request(app)
        .post('/api/simulations/credits')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const sim = res.body.data.simulation;
      const rows = res.body.data.rows;

      expect(sim.id).toBeDefined();
      expect(Number(sim.monto)).toBe(10000);
      expect(sim.plazoMeses).toBe(12);
      expect(sim.sistemaAmortizacion).toBe('FRANCES');
      expect(Number(sim.tasaAnual)).toBe(15.74);
      expect(Number(sim.cuotaInicial)).toBeGreaterThan(0);
      expect(Number(sim.totalIntereses)).toBeGreaterThan(0);
      expect(Number(sim.totalPagar)).toBeGreaterThan(10000);
      expect(rows).toBeInstanceOf(Array);
      expect(rows).toHaveLength(12);

      // Verificación de saldo final cero en la última cuota
      expect(Number(rows[11].saldoFinal)).toBe(0);
    });

    test('la ruta alias POST /api/simulations/credit opera de forma idéntica a /simulations/credits', async () => {
      const res = await request(app)
        .post('/api/simulations/credit')
        .send({
          creditTypeId: creditoConsumo.id,
          amount: 5000,
          termMonths: 12,
          amortizationSystem: 'ALEMAN',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.simulation.sistemaAmortizacion).toBe('ALEMAN');
      expect(res.body.data.rows).toHaveLength(12);
    });
  });

  // =========================================================================
  // SECCIÓN 13: CASO REALISTA DE CONSUMO ECUADOR (10,000 USD / 15.74% TEA / 12 Meses)
  // =========================================================================
  describe('Caso de Consumo Regulado Ecuador (10,000 USD / 15.74% TEA / 12 meses)', () => {
    test('convierte correctamente la tasa anual efectiva a mensual y amortiza el monto total', async () => {
      const res = await request(app)
        .post('/api/simulations/credits')
        .send({
          creditTypeId: creditoConsumo.id,
          amount: 10000,
          termMonths: 12,
          amortizationSystem: 'FRANCES',
        });

      expect(res.status).toBe(201);
      const sim = res.body.data.simulation;
      const rows = res.body.data.rows;

      // TEA 15.74% convertida con (1 + 0.1574)^(30/360) - 1 = ~0.0122444
      expect(Number(sim.tasaMensual)).toBeCloseTo(0.012244, 4);

      // Capital amortizado total exacto a 10,000 USD
      expectCloseToMoney(sim.totalCapital, 10000, 0.01);
      expect(Number(rows[11].saldoFinal)).toBe(0.00);

      // Incluye el desglose de Contribución SOLCA 0.50% (50.00 USD)
      const cargoSolca = sim.desgloseCargos.find(c => c.nombre.includes('SOLCA'));
      expect(cargoSolca).toBeDefined();
      expect(Number(cargoSolca.valor)).toBe(50.00);
    });
  });

  // =========================================================================
  // SECCIÓN 17: VALIDACIONES DE ENTRADA Y LÍMITES
  // =========================================================================
  describe('Validaciones de Entrada de la Simulación', () => {
    test('rechaza simulación con monto menor al monto mínimo del producto (Código 400)', async () => {
      const res = await request(app)
        .post('/api/simulations/credits')
        .send({
          creditTypeId: creditoConsumo.id,
          amount: 100, // Mínimo es 500
          termMonths: 12,
          amortizationSystem: 'FRANCES',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/monto debe estar entre/i);
    });

    test('rechaza simulación con plazo fuera de los límites del producto (Código 400)', async () => {
      const res = await request(app)
        .post('/api/simulations/credits')
        .send({
          creditTypeId: creditoConsumo.id,
          amount: 5000,
          termMonths: 120, // Máximo es 48
          amortizationSystem: 'FRANCES',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/plazo debe estar entre/i);
    });

    test('rechaza simulación con creditTypeId que no existe (Código 404)', async () => {
      const res = await request(app)
        .post('/api/simulations/credits')
        .send({
          creditTypeId: 999999,
          amount: 5000,
          termMonths: 12,
          amortizationSystem: 'FRANCES',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test('rechaza sistema de amortización inválido (Código 400)', async () => {
      const res = await request(app)
        .post('/api/simulations/credits')
        .send({
          creditTypeId: creditoConsumo.id,
          amount: 5000,
          termMonths: 12,
          amortizationSystem: 'AMERICANO', // No permitido
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // CONSULTA DE SIMULACIÓN Y DESCARGA DE PDF (SECCIÓN 25)
  // =========================================================================
  describe('Consulta de Simulación Guardada y Generación de PDF', () => {
    let simulationId;

    beforeAll(async () => {
      const simRes = await request(app)
        .post('/api/simulations/credits')
        .send({
          creditTypeId: creditoConsumo.id,
          amount: 8000,
          termMonths: 12,
          amortizationSystem: 'FRANCES',
        });

      simulationId = simRes.body.data.simulation.id;
    });

    test('GET /api/simulations/credits/:id recupera la simulación con sus cuotas', async () => {
      const res = await request(app).get(`/api/simulations/credits/${simulationId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.simulation.id).toBe(simulationId);
      expect(res.body.data.simulation.rows).toHaveLength(12);
    });

    test('GET /api/simulations/credits/:id/pdf genera y retorna un documento PDF válido no vacío', async () => {
      const res = await request(app)
        .get(`/api/simulations/credits/${simulationId}/pdf`)
        .responseType('blob'); // Buffer binario

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/i);
      expect(res.body).toBeDefined();
      // Debe ser un buffer o string no vacío
      const bufferLength = Buffer.byteLength(res.body);
      expect(bufferLength).toBeGreaterThan(1000); // Un PDF real con tabla tiene al menos varios kilobytes
    });
  });
});
