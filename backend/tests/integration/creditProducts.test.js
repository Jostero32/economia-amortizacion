/**
 * Pruebas de Integración - Catálogo de Productos de Crédito
 * Endpoints:
 * - GET /api/credit-products (Público)
 * - GET /api/credit-products/:id (Público)
 */

const request = require('supertest');
const app = require('../../src/app');
const { CreditType } = require('../../src/models');
const { initTestDatabase, seedCompleteData, closeTestDatabase } = require('../helpers/dbSetup');

describe('Integración: Catálogo Público de Créditos (/api/credit-products)', () => {
  let sampleProduct;

  beforeAll(async () => {
    await initTestDatabase();
    await seedCompleteData();
    sampleProduct = await CreditType.findOne({ where: { nombre: 'Crédito de Consumo' } });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('GET /api/credit-products lista todos los productos activos sin requerir autenticación', async () => {
    const res = await request(app).get('/api/credit-products');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products).toBeInstanceOf(Array);
    expect(res.body.data.products.length).toBeGreaterThan(0);

    const firstProduct = res.body.data.products[0];
    expect(firstProduct.id).toBeDefined();
    expect(firstProduct.nombre).toBeDefined();
    expect(firstProduct.montoMinimo).toBeDefined();
    expect(firstProduct.montoMaximo).toBeDefined();
    expect(firstProduct.segment).toBeDefined();
    expect(firstProduct.segment.tasaMaxima).toBeDefined();
    expect(firstProduct.segment.tasaReferencial).toBeDefined();
  });

  test('todos los productos activos tienen una tasa institucional menor o igual al techo máximo del BCE para su segmento', async () => {
    const res = await request(app).get('/api/credit-products');
    const products = res.body.data.products;

    products.forEach(prod => {
      const tasaProd = Number(prod.tasaInstitucion);
      const techoBCE = Number(prod.segment.tasaMaxima);
      expect(tasaProd).toBeLessThanOrEqual(techoBCE);
    });
  });

  test('GET /api/credit-products/:id obtiene el detalle de un producto específico', async () => {
    const res = await request(app).get(`/api/credit-products/${sampleProduct.id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.product.id).toBe(sampleProduct.id);
    expect(res.body.data.product.nombre).toBe(sampleProduct.nombre);
    expect(res.body.data.product.segment).toBeDefined();
  });

  test('GET /api/credit-products/:id con ID inexistente retorna 404 No Encontrado', async () => {
    const res = await request(app).get('/api/credit-products/999999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
