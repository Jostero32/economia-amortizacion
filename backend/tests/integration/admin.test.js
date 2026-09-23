/**
 * Pruebas de Integración - Matriz de Autorización por Roles y CRUD Administrativo
 * Endpoints: /api/admin/*
 * Valida distinción 401 (No Autenticado) vs 403 (Sin Permisos), y operaciones de ADMIN y ASESOR.
 */

const request = require('supertest');
const app = require('../../src/app');
const { CreditSegment, User } = require('../../src/models');
const {
  initTestDatabase,
  seedCompleteData,
  generateTestToken,
  closeTestDatabase,
} = require('../helpers/dbSetup');

describe('Integración: Control de Acceso por Roles y CRUD Administrativo (/api/admin)', () => {
  let adminUser;
  let adminToken;
  let advisorUser;
  let advisorToken;
  let clientUser;
  let clientToken;
  let consumoSegment;

  beforeAll(async () => {
    await initTestDatabase();
    await seedCompleteData();

    adminUser = await User.findOne({ where: { rol: 'ADMIN' } });
    adminToken = generateTestToken(adminUser);

    advisorUser = await User.findOne({ where: { rol: 'ASESOR' } });
    advisorToken = generateTestToken(advisorUser);

    clientUser = await User.findOne({ where: { rol: 'CLIENTE' } });
    clientToken = generateTestToken(clientUser);

    consumoSegment = await CreditSegment.findOne({ where: { codigo: 'CONSUMO' } });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // =========================================================================
  // SECCIÓN 21: MATRIZ DE AUTORIZACIÓN (401 VS 403)
  // =========================================================================
  describe('Matriz de Permisos y Protección de Rutas Administrativas', () => {
    test('solicitud sin autenticación a ruta admin retorna 401 No Autorizado', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/No se proporcionó un token/i);
    });

    test('solicitud de usuario con rol CLIENTE a ruta admin retorna 403 Prohibido', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Acceso no autorizado/i);
    });

    test('solicitud de usuario ASESOR a ruta de asesor retorna 200 Exitoso', async () => {
      const res = await request(app)
        .get('/api/admin/applications')
        .set('Authorization', `Bearer ${advisorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('solicitud de usuario ASESOR a ruta exclusiva de ADMIN (tasas o institución) retorna 403', async () => {
      const res = await request(app)
        .put('/api/admin/institution')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({ nombre: 'Nuevo Nombre Ficticio' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('solicitud de usuario ADMIN a ruta exclusiva de configuración retorna 200 Exitoso', async () => {
      const res = await request(app)
        .get('/api/admin/institution')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Personalización institucional', () => {
    test('ADMIN puede actualizar datos y colores institucionales validados', async () => {
      const res = await request(app)
        .put('/api/admin/institution')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Cooperativa Académica Ecuador',
          tipo: 'COOPERATIVA',
          ruc: '1790012345001',
          direccion: 'Av. Universidad y República, Quito',
          telefono: '02-299-9999',
          email: 'contacto@finanecuador.local',
          sitioWeb: 'https://finanecuador.local',
          logo: '/LogoFinanEcuador.png',
          colorPrincipal: '#123456',
          colorSecundario: '#0A67D8',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.institution.nombre).toBe('Cooperativa Académica Ecuador');
      expect(res.body.data.institution.colorPrincipal).toBe('#123456');
    });

    test('rechaza RUC y colores institucionales con formato inválido', async () => {
      const res = await request(app)
        .put('/api/admin/institution')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Institución Inválida',
          tipo: 'BANCO_PRIVADO',
          ruc: '123',
          direccion: 'Quito',
          telefono: '02-299-9999',
          email: 'contacto@institucion.local',
          colorPrincipal: 'azul',
          colorSecundario: '#0050cc',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    test('ADMIN puede subir un logotipo institucional y se publica desde uploads', async () => {
      const minimalPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const res = await request(app)
        .post('/api/admin/institution/logo')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('logo', minimalPng, { filename: 'marca.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logo).toMatch(/^\/uploads\/marca-/);
      expect(res.body.data.institution.logo).toBe(res.body.data.logo);
    });

    test('rechaza archivos que no son imágenes como logotipo', async () => {
      const res = await request(app)
        .post('/api/admin/institution/logo')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('logo', Buffer.from('no es una imagen'), {
          filename: 'documento.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Gestión de usuarios, roles y acceso', () => {
    test('ASESOR no puede cambiar roles ni bloquear cuentas', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${clientUser.id}/access`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send({ rol: 'ASESOR' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('ADMIN puede asignar un rol y bloquear una cuenta', async () => {
      const updateRes = await request(app)
        .patch(`/api/admin/users/${clientUser.id}/access`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rol: 'ASESOR', activo: false });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.user.rol).toBe('ASESOR');
      expect(updateRes.body.data.user.activo).toBe(false);

      const blockedRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(blockedRes.status).toBe(401);

      const restoreRes = await request(app)
        .patch(`/api/admin/users/${clientUser.id}/access`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rol: 'CLIENTE', activo: true });
      expect(restoreRes.status).toBe(200);
    });

    test('rechaza roles que no pertenecen a la matriz permitida', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${clientUser.id}/access`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rol: 'SUPERUSUARIO' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('el administrador no puede degradar ni bloquear su propia cuenta', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminUser.id}/access`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rol: 'CLIENTE', activo: false });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/propia cuenta/i);
    });
  });

  // =========================================================================
  // SECCIÓN 12 Y 22: CRUD DE PRODUCTO Y CONTROL ESTRICTO DE TECHO BCE
  // =========================================================================
  describe('Gestión de Productos de Crédito y Techo Regulatorio BCE', () => {
    test('ADMIN puede crear un nuevo producto con tasa menor o igual al techo BCE (15.74% <= 16.77%)', async () => {
      const payload = {
        nombre: 'Crédito Festivo Test',
        descripcion: 'Producto temporal para pruebas',
        segmentId: consumoSegment.id,
        tasaInstitucion: 16.00, // Menor al techo de 16.77%
        montoMinimo: 1000,
        montoMaximo: 15000,
        plazoMinimo: 6,
        plazoMaximo: 24,
      };

      const res = await request(app)
        .post('/api/admin/credit-products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.id).toBeDefined();
    });

    test('ADMIN NO puede crear un producto cuya tasa exceda el techo del BCE (16.78% > 16.77% rechazada con 400)', async () => {
      const payloadInvalido = {
        nombre: 'Crédito Usurario Ilegal',
        descripcion: 'Tasa por encima del techo regulatorio',
        segmentId: consumoSegment.id,
        tasaInstitucion: 16.78, // Supera el 16.77% de Consumo
        montoMinimo: 1000,
        montoMaximo: 15000,
        plazoMinimo: 6,
        plazoMaximo: 24,
      };

      const res = await request(app)
        .post('/api/admin/credit-products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payloadInvalido);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/supera la tasa activa efectiva máxima/i);
    });
  });

  // =========================================================================
  // SECCIÓN 22: CRUD DE CARGOS Y PRODUCTOS DE INVERSIÓN
  // =========================================================================
  describe('Gestión Administrativa de Cobros y Productos de Inversión', () => {
    test('ADMIN puede crear un cargo administrativo', async () => {
      const res = await request(app)
        .post('/api/admin/charges')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Comisión Test Auditoría',
          tipo: 'VALOR_FIJO',
          valor: 15.00,
          aplicacion: 'UNA_VEZ',
          esObligatorio: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.charge.id).toBeDefined();
    });

    test('ADMIN puede registrar un nuevo producto de inversión DPF', async () => {
      const res = await request(app)
        .post('/api/admin/investments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nombre: 'Inversión Plazo Fijo Premium',
          descripcion: 'DPF preferencial para socios de alto patrimonio',
          montoMinimo: 25000,
          montoMaximo: 200000,
          plazoMinimoDias: 180,
          plazoMaximoDias: 720,
          tasa: 7.20,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.id).toBeDefined();
    });
  });

  // =========================================================================
  // SECCIÓN 28: SEGURIDAD Y PRIVACIDAD EN RESPUESTAS DE ERROR
  // =========================================================================
  describe('Control de Fuga de Información Sensible', () => {
    test('las respuestas de error no exponen JWT_SECRET, contraseñas ni credenciales de DB', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'fake@error.local', password: 'mal' });

      const responseString = JSON.stringify(res.body);
      expect(responseString).not.toMatch(/postgres/i);
      expect(responseString).not.toMatch(/JWT_SECRET/i);
      expect(responseString).not.toMatch(/development-secret/i);
      expect(responseString).not.toMatch(/DB_PASSWORD/i);
    });
  });
});
