/**
 * Pruebas de Integración - Autenticación y Gestión de Sesión
 * Endpoints: /api/auth (register, login, logout, me)
 * Valida cookies HttpOnly, protección de contraseñas y unicidad de registros.
 */

const request = require('supertest');
const app = require('../../src/app');
const { initTestDatabase, cleanDatabase, closeTestDatabase } = require('../helpers/dbSetup');

describe('Integración: Módulo de Autenticación (/api/auth)', () => {
  beforeAll(async () => {
    await initTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // =========================================================================
  // REGISTRO DE USUARIO
  // =========================================================================
  describe('POST /api/auth/register', () => {
    const validUser = {
      nombre: 'Mateo Proaño',
      email: 'mateo@test.local',
      password: 'Password123!',
      cedula: '1720000001',
      telefono: '0987654321',
    };

    test('registra exitosamente un nuevo cliente y retorna token y cookie HttpOnly', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(validUser.email);
      expect(res.body.data.user.rol).toBe('CLIENTE');
      // No debe exponer el hash de la contraseña en la respuesta
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.token).toBeDefined();

      // Comprobar que se envía la cookie HttpOnly
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/HttpOnly/i);
    });

    test('rechaza el registro con correo electrónico duplicado (Código 409)', async () => {
      // Primer registro
      await request(app).post('/api/auth/register').send(validUser);

      // Segundo registro con el mismo email
      const resDuplicado = await request(app)
        .post('/api/auth/register')
        .send({
          ...validUser,
          nombre: 'Otro Nombre',
          cedula: '1720000002',
        });

      expect(resDuplicado.status).toBe(409);
      expect(resDuplicado.body.success).toBe(false);
      expect(resDuplicado.body.message).toMatch(/correo electrónico ya se encuentra registrado/i);
    });

    test('rechaza el registro con número de cédula duplicado (Código 409)', async () => {
      // Primer registro
      await request(app).post('/api/auth/register').send(validUser);

      // Segundo registro con email diferente pero misma cédula
      const resCedulaDuplicada = await request(app)
        .post('/api/auth/register')
        .send({
          ...validUser,
          email: 'otroemail@test.local',
        });

      expect(resCedulaDuplicada.status).toBe(409);
      expect(resCedulaDuplicada.body.success).toBe(false);
      expect(resCedulaDuplicada.body.message).toMatch(/cédula ya se encuentra registrada/i);
    });

    test('rechaza registro con datos inválidos (cédula incompleta o contraseña corta)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          nombre: 'A', // Demasiado corto
          email: 'invalido',
          password: '123', // < 6 chars
          cedula: '123', // != 10 dígitos
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // INICIO DE SESIÓN (LOGIN)
  // =========================================================================
  describe('POST /api/auth/login', () => {
    const credenciales = {
      nombre: 'Usuario Login Test',
      email: 'login@test.local',
      password: 'MiPasswordSeguro123!',
      cedula: '1720000005',
    };

    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(credenciales);
    });

    test('inicia sesión correctamente con credenciales válidas y genera cookie HttpOnly', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: credenciales.email,
          password: credenciales.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(credenciales.email);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.token).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toMatch(/HttpOnly/i);
    });

    test('rechaza inicio de sesión con contraseña incorrecta (Código 401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: credenciales.email,
          password: 'PasswordErroneo!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Credenciales inválidas/i);
    });

    test('rechaza inicio de sesión con email que no existe en el sistema (Código 401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'noexiste@test.local',
          password: 'CualquierPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Credenciales inválidas/i);
    });
  });

  // =========================================================================
  // CONSULTA DE PERFIL /api/auth/me Y CIERRE DE SESIÓN /api/auth/logout
  // =========================================================================
  describe('GET /api/auth/me y POST /api/auth/logout', () => {
    let authCookie;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          nombre: 'Usuario Sesion Test',
          email: 'sesion@test.local',
          password: 'PasswordValido123!',
          cedula: '1720000008',
        });

      authCookie = regRes.headers['set-cookie'];
    });

    test('GET /api/auth/me sin autenticación retorna 401 No Autorizado', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Acceso denegado/i);
    });

    test('GET /api/auth/me con cookie de autenticación retorna perfil del usuario', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('sesion@test.local');
    });

    test('POST /api/auth/logout limpia la cookie de sesión', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      // La cookie token debe expirar o quedar vacía
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
    });
  });
});
