/**
 * Pruebas de Integración - Carga y Revisión de Documentos y Reconocimiento Facial
 * Endpoints:
 * - POST /api/documents (Subida de Cédula y Selfie)
 * - GET /api/documents/:id
 * - PATCH /api/admin/documents/:id/status (Revisión por Asesor/Admin)
 * - PATCH /api/admin/applications/:id/biometric (Resultado del reconocimiento facial)
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

    const apiPrivateRes = await request(app).get(`/api/uploads/documentos/${doc.ruta}`);
    expect(apiPrivateRes.status).toBe(404);
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

  test('POST /api/documents exige autorizar el tratamiento biométrico para subir la selfie', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('tipo', 'SELFIE')
      .field('creditApplicationId', application.id)
      .attach('archivo', Buffer.from('simulated-selfie-photo'), 'selfie_rostro.png');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('autorizar');
  });

  test('POST /api/documents permite subir la selfie con consentimiento biométrico', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('tipo', 'SELFIE')
      .field('consentimientoBiometrico', 'true')
      .field('creditApplicationId', application.id)
      .attach('archivo', Buffer.from('simulated-selfie-photo'), 'selfie_rostro.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.document.tipo).toBe('SELFIE');
  });

  test('POST /api/documents rechaza la cédula en PDF: el reconocimiento facial necesita una imagen', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('tipo', 'CEDULA')
      .field('creditApplicationId', application.id)
      .attach('archivo', Buffer.from('%PDF-1.4 cedula'), 'cedula.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('no PDF');
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

  test('rechazar un documento exige indicar el motivo para el cliente', async () => {
    const withoutReason = await request(app)
      .patch(`/api/admin/documents/${cedulaDocumentId}/status`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ estado: 'RECHAZADO' });
    expect(withoutReason.status).toBe(400);
    expect(withoutReason.body.errors.comentarioRevision).toBeDefined();

    const withReason = await request(app)
      .patch(`/api/admin/documents/${cedulaDocumentId}/status`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ estado: 'RECHAZADO', comentarioRevision: 'La imagen está borrosa.' });
    expect(withReason.status).toBe(200);
  });

  test('PATCH /api/admin/applications/:id/biometric registra el resultado del reconocimiento facial', async () => {
    const res = await request(app)
      .patch(`/api/admin/applications/${application.id}/biometric`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ tipo: 'CREDITO', similitud: 91.27, distancia: 0.4183, resultado: 'COINCIDE' });

    expect(res.status).toBe(200);
    expect(Number(res.body.data.application.biometriaSimilitud)).toBe(91.27);
    expect(Number(res.body.data.application.biometriaDistancia)).toBe(0.4183);
    expect(res.body.data.application.biometriaResultado).toBe('COINCIDE');
    expect(res.body.data.application.biometriaComparadaEn).toBeDefined();
    // Es evidencia de apoyo: no aprueba la biometría por sí solo
    expect(res.body.data.application.biometriaValidada).toBe(false);
  });

  test('PATCH /api/admin/applications/:id/biometric valida los datos y es solo para asesores', async () => {
    const invalid = await request(app)
      .patch(`/api/admin/applications/${application.id}/biometric`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ tipo: 'CREDITO', similitud: 140, distancia: 0.4, resultado: 'COINCIDE' });
    expect(invalid.status).toBe(400);

    const badResult = await request(app)
      .patch(`/api/admin/applications/${application.id}/biometric`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ tipo: 'CREDITO', similitud: 80, distancia: 0.4, resultado: 'QUIZAS' });
    expect(badResult.status).toBe(400);

    const asClient = await request(app)
      .patch(`/api/admin/applications/${application.id}/biometric`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ tipo: 'CREDITO', similitud: 99, distancia: 0.1, resultado: 'COINCIDE' });
    expect(asClient.status).toBe(403);
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
