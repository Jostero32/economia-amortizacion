/**
 * Pruebas de Integración - Solicitudes de Crédito e Inversión (Portal Cliente)
 * Endpoints:
 * - POST /api/credit-applications (Requiere Auth)
 * - GET /api/credit-applications/my (Requiere Auth)
 * - POST /api/investment-applications (Requiere Auth)
 * - GET /api/investment-applications/my (Requiere Auth)
 */

const request = require('supertest');
const app = require('../../src/app');
const { CreditType, Document, InvestmentProduct, User } = require('../../src/models');
const {
  initTestDatabase,
  seedCompleteData,
  generateTestToken,
  closeTestDatabase,
} = require('../helpers/dbSetup');

describe('Integración: Solicitudes de Cliente (/api/credit-applications y /api/investment-applications)', () => {
  let clientUser;
  let clientToken;
  let advisorUser;
  let advisorToken;
  let creditProduct;
  let investmentProduct;
  let investmentApplicationId;

  beforeAll(async () => {
    await initTestDatabase();
    await seedCompleteData();

    clientUser = await User.findOne({ where: { rol: 'CLIENTE' } });
    clientToken = generateTestToken(clientUser);
    advisorUser = await User.findOne({ where: { rol: 'ASESOR' } });
    advisorToken = generateTestToken(advisorUser);

    creditProduct = await CreditType.findOne({ where: { nombre: 'Crédito de Consumo' } });
    investmentProduct = await InvestmentProduct.findOne({ where: { activo: true } });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('POST /api/credit-applications sin token retorna 401 No Autorizado', async () => {
    const res = await request(app)
      .post('/api/credit-applications')
      .send({
        creditTypeId: creditProduct.id,
        monto: 5000,
      });

    expect(res.status).toBe(401);
  });

  test('POST /api/credit-applications con cliente autenticado registra solicitud de crédito', async () => {
    const payload = {
      creditTypeId: creditProduct.id,
      monto: 5000,
      plazoMeses: 12,
      sistemaAmortizacion: 'FRANCES',
      nombres: 'Carlos',
      apellidos: 'Mendoza',
      cedula: '1723456789',
      direccion: 'Av. 10 de Agosto y Colón',
      ciudad: 'Quito',
      telefono: '0998877665',
      email: 'carlos@cliente.local',
      ingresosMensuales: 1500,
      egresosMensuales: 600,
    };

    const res = await request(app)
      .post('/api/credit-applications')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.application.id).toBeDefined();
    expect(Number(res.body.data.application.monto)).toBe(5000);
    expect(res.body.data.application.estado).toMatch(/PENDIENTE|EN_REVISION|BORRADOR|RECIBIDA/i);
  });

  test('GET /api/credit-applications/my lista las solicitudes del cliente autenticado', async () => {
    const res = await request(app)
      .get('/api/credit-applications/my')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.applications).toBeInstanceOf(Array);
    expect(res.body.data.applications.length).toBeGreaterThan(0);
  });

  test('POST /api/investment-applications registra solicitud de depósito a plazo fijo', async () => {
    const payload = {
      investmentProductId: investmentProduct.id,
      monto: 10000,
      plazoDias: 360,
      nombres: 'Carlos',
      apellidos: 'Mendoza',
      cedula: '1723456789',
      direccion: 'Av. 10 de Agosto y Colón',
      ciudad: 'Quito',
      telefono: '0998877665',
      email: 'carlos@cliente.local',
      actividadEconomica: 'Empleado bajo relación de dependencia',
      ingresosMensuales: 1500,
      origenFondos: 'Ahorros laborales',
      finalidadInversion: 'Ahorro para estudios de posgrado',
    };

    const res = await request(app)
      .post('/api/investment-applications')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.application.id).toBeDefined();
    expect(res.body.data.application.origenFondos).toBe('Ahorros laborales');
    investmentApplicationId = res.body.data.application.id;
  });

  test('GET /api/investment-applications/my lista las solicitudes de inversión del cliente', async () => {
    const res = await request(app)
      .get('/api/investment-applications/my')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.applications).toBeInstanceOf(Array);
    expect(res.body.data.applications.length).toBeGreaterThan(0);
  });

  test('formaliza una simulación pública como solicitud de inversión autenticada', async () => {
    const simulationResponse = await request(app)
      .post('/api/simulations/investments')
      .send({
        investmentProductId: investmentProduct.id,
        amount: 12000,
        termDays: 180,
      });

    const simulation = simulationResponse.body.data.simulation;
    const res = await request(app)
      .post('/api/investment-applications')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        simulationId: simulation.id,
        investmentProductId: investmentProduct.id,
        monto: simulation.monto,
        plazoDias: simulation.plazoDias,
        nombres: 'Carlos',
        apellidos: 'Mendoza',
        cedula: '1723456789',
        telefono: '0998877665',
        email: 'carlos@cliente.local',
        actividadEconomica: 'Empleado bajo relación de dependencia',
        ingresosMensuales: 1500,
        origenFondos: 'Ahorros laborales',
        finalidadInversion: 'Fondo para estudios',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.application.simulationId).toBe(simulation.id);
    expect(Number(res.body.data.application.valorFinalEstimado)).toBe(Number(simulation.valorFinal));
  });

  test('GET /api/admin/investment-applications/:id permite al asesor revisar la inversión', async () => {
    const res = await request(app)
      .get(`/api/admin/investment-applications/${investmentApplicationId}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.application.id).toBe(investmentApplicationId);
    expect(res.body.data.application.product).toBeDefined();
  });

  test('el asesor aprueba la inversión cuando documentos y biometría están validados', async () => {
    const documentTypes = ['CEDULA', 'COMPROBANTE_DOMICILIO', 'COMPROBANTE_INGRESOS', 'SELFIE'];

    await Promise.all(documentTypes.map((tipo) => Document.create({
      investmentApplicationId,
      tipo,
      nombreArchivo: `${tipo.toLowerCase()}.pdf`,
      ruta: `${tipo.toLowerCase()}-test.pdf`,
      mimeType: 'application/pdf',
      tamano: 1024,
      estado: 'VALIDADO',
      revisadoPor: advisorUser.id,
    })));

    const res = await request(app)
      .patch(`/api/admin/applications/${investmentApplicationId}/status`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        tipo: 'INVERSION',
        estado: 'APROBADA',
        biometriaValidada: true,
        observacionAsesor: 'Origen de fondos y expediente validados.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.application.estado).toBe('APROBADA');
    expect(res.body.data.application.biometriaValidada).toBe(true);
  });
});
