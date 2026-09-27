/**
 * Pruebas de Integración - Carga y Revisión de Documentos (Biometría Simulada)
 * Endpoints:
 * - POST /api/documents (Subida de Cédula y Selfie)
 * - GET /api/documents/:id
 * - PATCH /api/admin/documents/:id/status (Revisión por Asesor/Admin)
 */

const request = require('supertest');
const app = require('../../src/app');
const { CreditApplication, CreditType, Document, User } = require('../../src/models');
const {
  initTestDatabase,
  seedCompleteData,
  generateTestToken,
  closeTestDatabase,
} = require('../helpers/dbSetup');

describe('Integración: Carga de Documentos y Biometría (/api/documents)', () => {
  let clientUser;
  let clientToken;
  let advisorUser;
  let advisorToken;
  let application;
  let cedulaDocumentId;

  beforeAll(async () => {
    await initTestDatabase();
    await seedCompleteData();

    clientUser = await User.findOne({ where: { rol: 'CLIENTE' } });
    clientToken = generateTestToken(clientUser);

    advisorUser = await User.findOne({ where: { rol: 'ASESOR' } });
    advisorToken = generateTestToken(advisorUser);

    const creditProduct = await CreditType.findOne();
    application = await CreditApplication.create({
      userId: clientUser.id,
      creditTypeId: creditProduct.id,
      monto: 3000,
      plazoMeses: 12,
      sistemaAmortizacion: 'FRANCES',
      tasaAplicada: 15.74,
      cuotaEstimada: 271.85,
      nombres: 'Cliente',
      apellidos: 'Test',
      cedula: '1720000003',
      direccion: 'Quito',
      ciudad: 'Quito',
      telefono: '0991234567',
      email: clientUser.email,
      ingresosMensuales: 1200,
      egresosMensuales: 400,
      estado: 'EN_REVISION',
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('POST /api/documents permite a un cliente subir archivo de cédula simulada', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('tipo', 'CEDULA')
      .field('creditApplicationId', application.id)
      .attach('archivo', Buffer.from('simulated-cedula-content'), 'cedula_frontal.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.document.id).toBeDefined();
    expect(res.body.data.document.tipo).toBe('CEDULA');
    expect(res.body.data.document.estado).toBe('PENDIENTE');
    cedulaDocumentId = res.body.data.document.id;
  });

  test('GET /api/documents/:id permite visualizar el archivo cargado', async () => {
    const res = await request(app)
      .get(`/api/documents/${cedulaDocumentId}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('GET /api/documents/:id impide que otro cliente vea un documento ajeno (403)', async () => {
    const otherClient = await User.create({
      nombre: 'Otro Cliente',
      email: 'otro.cliente@test.local',
      password: 'Cliente123!',
      rol: 'CLIENTE',
    });
    const res = await request(app)
      .get(`/api/documents/${cedulaDocumentId}`)
      .set('Authorization', `Bearer ${generateTestToken(otherClient)}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/documents/:id permite al asesor revisar el documento del cliente', async () => {
    const res = await request(app)
      .get(`/api/documents/${cedulaDocumentId}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(200);
  });

  test('los documentos no se publican como archivos estáticos en /uploads', async () => {
    const doc = await Document.findByPk(cedulaDocumentId);

    const privateRes = await request(app).get(`/uploads/documentos/${doc.ruta}`);
    expect(privateRes.status).toBe(404);

    const rootRes = await request(app).get(`/uploads/${doc.ruta}`);
    expect(rootRes.status).toBe(404);
  });

  test('POST /api/documents solo lo puede usar el cliente (asesor recibe 403)', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${advisorToken}`)
      .field('tipo', 'OTRO')
      .field('creditApplicationId', application.id)
      .attach('archivo', Buffer.from('archivo-asesor'), 'nota.pdf');

    expect(res.status).toBe(403);
  });

  test('POST /api/documents permite subir selfie para biometría simulada', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('tipo', 'SELFIE')
      .field('creditApplicationId', application.id)
      .attach('archivo', Buffer.from('simulated-selfie-photo'), 'selfie_rostro.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.document.tipo).toBe('SELFIE');
  });

  test('PATCH /api/admin/documents/:id/status permite a un Asesor aprobar documento', async () => {
    // Primero subir documento
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('tipo', 'COMPROBANTE_DOMICILIO')
      .field('creditApplicationId', application.id)
      .attach('archivo', Buffer.from('planilla-luz'), 'planilla.pdf');

    const docId = uploadRes.body.data.document.id;

    // Asesor aprueba el documento con estado VALIDADO
    const res = await request(app)
      .patch(`/api/admin/documents/${docId}/status`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        estado: 'VALIDADO',
        comentarioRevision: 'Documento legible y verificado.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.document.estado).toBe('VALIDADO');
  });

  test('PATCH /api/admin/applications/:id/status impide aprobar un expediente incompleto', async () => {
    const res = await request(app)
      .patch(`/api/admin/applications/${application.id}/status`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        estado: 'APROBADA',
        biometriaValidada: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Faltan documentos validados');
  });

  test('PATCH /api/admin/applications/:id/status aprueba al validar documentos y biometría', async () => {
    await Document.update(
      { estado: 'VALIDADO', revisadoPor: advisorUser.id },
      { where: { creditApplicationId: application.id } }
    );

    await Document.create({
      creditApplicationId: application.id,
      tipo: 'COMPROBANTE_INGRESOS',
      nombreArchivo: 'rol_pagos.pdf',
      ruta: 'rol_pagos-test.pdf',
      mimeType: 'application/pdf',
      tamano: 1024,
      estado: 'VALIDADO',
      revisadoPor: advisorUser.id,
    });

    const res = await request(app)
      .patch(`/api/admin/applications/${application.id}/status`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        estado: 'APROBADA',
        biometriaValidada: true,
        observacionAsesor: 'Expediente completo y validado.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.application.estado).toBe('APROBADA');
    expect(res.body.data.application.biometriaValidada).toBe(true);
  });
});
