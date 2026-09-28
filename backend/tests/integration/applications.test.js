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
    investmentProduct = await InvestmentProduct.findOne({ where: { nombre: 'Depósito a Plazo Fijo' } });
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
      cedula: '1723456784',
      direccion: 'Av. 10 de Agosto y Colón',
      ciudad: 'Quito',
      telefono: '0998877665',
      email: 'carlos@cliente.local',
      fechaNacimiento: '1990-05-15',
      estadoCivil: 'Casado/a',
      actividadEconomica: 'Empleado privado',
      ingresosMensuales: 1500,
      egresosMensuales: 600,
      autorizaConsultaBuro: true,
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

  describe('Reglas de la solicitud de crédito', () => {
    const basePersonalData = {
      nombres: 'Carlos',
      apellidos: 'Mendoza',
      cedula: '1723456784',
      direccion: 'Av. 10 de Agosto y Colón',
      ciudad: 'Quito',
      telefono: '0998877665',
      email: 'carlos@cliente.local',
      fechaNacimiento: '1990-05-15',
      actividadEconomica: 'Empleado privado',
      ingresosMensuales: 1500,
      egresosMensuales: 600,
      autorizaConsultaBuro: true,
    };

    async function simulate(extra = {}) {
      const res = await request(app)
        .post('/api/simulations/credits')
        .send({ creditTypeId: creditProduct.id, amount: 4000, termMonths: 12, amortizationSystem: 'FRANCES', ...extra });
      return res.body.data.simulation;
    }

    function applicationFrom(simulation, extra = {}) {
      return {
        simulationId: simulation.id,
        creditTypeId: simulation.creditTypeId,
        monto: simulation.monto,
        plazoMeses: simulation.plazoMeses,
        sistemaAmortizacion: simulation.sistemaAmortizacion,
        ...basePersonalData,
        ...extra,
      };
    }

    test('asigna un código correlativo y guarda la tabla de la simulación', async () => {
      const simulation = await simulate();
      const res = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(applicationFrom(simulation));

      expect(res.status).toBe(201);
      expect(res.body.data.application.codigo).toMatch(/^SOL-CRE-\d{4}-\d{6}$/);
      expect(res.body.data.application.autorizaConsultaBuro).toBe(true);
      expect(Number(res.body.data.application.relacionCuotaIngreso)).toBeGreaterThan(0);

      const detail = await request(app)
        .get(`/api/credit-applications/${res.body.data.application.id}`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect(detail.body.data.application.simulation.rows).toHaveLength(12);
    });

    test('no permite dos solicitudes con la misma simulación (409)', async () => {
      const simulation = await simulate();
      const first = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(applicationFrom(simulation));
      expect(first.status).toBe(201);

      const second = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(applicationFrom(simulation));
      expect(second.status).toBe(409);
    });

    test('rechaza usar la simulación guardada de otro cliente (403)', async () => {
      const otherClient = await User.create({
        nombre: 'Otra Clienta',
        email: 'otra.clienta@test.local',
        password: 'Cliente123!',
        rol: 'CLIENTE',
      });
      const simRes = await request(app)
        .post('/api/simulations/credits')
        .set('Authorization', `Bearer ${generateTestToken(otherClient)}`)
        .send({ creditTypeId: creditProduct.id, amount: 4000, termMonths: 12, amortizationSystem: 'FRANCES' });

      const res = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(applicationFrom(simRes.body.data.simulation));
      expect(res.status).toBe(403);
    });

    test('rechaza si la cuota supera los ingresos disponibles, con un mensaje claro', async () => {
      const simulation = await simulate();
      const res = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(applicationFrom(simulation, { ingresosMensuales: 500, egresosMensuales: 400 }));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/supera tus ingresos disponibles/);
    });

    test('valida cédula, mayoría de edad y autorización de consulta al buró', async () => {
      const simulation = await simulate();
      const res = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(applicationFrom(simulation, {
          cedula: '1710000001',
          fechaNacimiento: `${new Date().getFullYear() - 16}-01-01`,
          autorizaConsultaBuro: false,
        }));

      expect(res.status).toBe(400);
      expect(res.body.errors.cedula).toMatch(/cédula no es válida/);
      expect(res.body.errors.fechaNacimiento).toMatch(/mayor de edad/);
      expect(res.body.errors.autorizaConsultaBuro).toBeDefined();
    });

    test('rechaza si al terminar el crédito el cliente superaría la edad máxima', async () => {
      const simulation = await simulate({ termMonths: 48 });
      const res = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(applicationFrom(simulation, { fechaNacimiento: `${new Date().getFullYear() - 78}-01-01` }));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/más de 80 años/);
    });

    test('un asesor no puede registrar solicitudes a su nombre (403)', async () => {
      const simulation = await simulate();
      const res = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${advisorToken}`)
        .send(applicationFrom(simulation));
      expect(res.status).toBe(403);
    });
  });

  describe('Póliza de desgravamen propia', () => {
    test('aprobar exige la póliza endosada validada además de los 4 documentos', async () => {
      const inmobiliario = await CreditType.findOne({ where: { nombre: 'Crédito Inmobiliario' } });
      const simRes = await request(app)
        .post('/api/simulations/credits')
        .send({
          creditTypeId: inmobiliario.id,
          amount: 20000,
          termMonths: 120,
          amortizationSystem: 'FRANCES',
          polizaDesgravamenPropia: true,
        });
      const simulation = simRes.body.data.simulation;

      const created = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          simulationId: simulation.id,
          creditTypeId: simulation.creditTypeId,
          monto: simulation.monto,
          plazoMeses: simulation.plazoMeses,
          sistemaAmortizacion: simulation.sistemaAmortizacion,
          nombres: 'Carlos',
          apellidos: 'Mendoza',
          cedula: '1723456784',
          direccion: 'Av. 10 de Agosto y Colón',
          ciudad: 'Quito',
          telefono: '0998877665',
          email: 'carlos@cliente.local',
          fechaNacimiento: '1990-05-15',
          actividadEconomica: 'Empleado privado',
          ingresosMensuales: 1500,
          egresosMensuales: 600,
          autorizaConsultaBuro: true,
        });
      expect(created.status).toBe(201);
      const application = created.body.data.application;
      expect(application.polizaDesgravamenPropia).toBe(true);

      await Promise.all(['CEDULA', 'COMPROBANTE_DOMICILIO', 'COMPROBANTE_INGRESOS', 'SELFIE'].map((tipo) => Document.create({
        creditApplicationId: application.id,
        tipo,
        nombreArchivo: `${tipo}.pdf`,
        ruta: `${tipo}-poliza-test.pdf`,
        mimeType: 'application/pdf',
        tamano: 1024,
        estado: 'VALIDADO',
      })));

      const status = (body) => request(app)
        .patch(`/api/admin/applications/${application.id}/status`)
        .set('Authorization', `Bearer ${advisorToken}`)
        .send(body);

      expect((await status({ estado: 'EN_REVISION' })).status).toBe(200);

      const withoutPolicy = await status({ estado: 'APROBADA', biometriaValidada: true });
      expect(withoutPolicy.status).toBe(400);
      expect(withoutPolicy.body.message).toMatch(/póliza de desgravamen endosada/);

      await Document.create({
        creditApplicationId: application.id,
        tipo: 'POLIZA_DESGRAVAMEN',
        nombreArchivo: 'poliza.pdf',
        ruta: 'poliza-test.pdf',
        mimeType: 'application/pdf',
        tamano: 1024,
        estado: 'VALIDADO',
      });
      const approved = await status({ estado: 'APROBADA', biometriaValidada: true });
      expect(approved.status).toBe(200);
    });
  });

  describe('PDF de la solicitud', () => {
    let applicationId;

    beforeAll(async () => {
      const simRes = await request(app)
        .post('/api/simulations/credits')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ creditTypeId: creditProduct.id, amount: 2500, termMonths: 12, amortizationSystem: 'FRANCES' });
      const simulation = simRes.body.data.simulation;
      const res = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          simulationId: simulation.id,
          creditTypeId: simulation.creditTypeId,
          monto: simulation.monto,
          plazoMeses: simulation.plazoMeses,
          sistemaAmortizacion: simulation.sistemaAmortizacion,
          nombres: 'Carlos',
          apellidos: 'Mendoza',
          cedula: '1723456784',
          direccion: 'Av. 10 de Agosto y Colón',
          ciudad: 'Quito',
          telefono: '0998877665',
          email: 'carlos@cliente.local',
          fechaNacimiento: '1990-05-15',
          actividadEconomica: 'Empleado privado',
          ingresosMensuales: 1500,
          egresosMensuales: 600,
          autorizaConsultaBuro: true,
        });
      applicationId = res.body.data.application.id;
    });

    test('el cliente descarga el PDF de su solicitud con la tabla de amortización', async () => {
      const res = await request(app)
        .get(`/api/credit-applications/${applicationId}/pdf`)
        .set('Authorization', `Bearer ${clientToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toMatch(/Solicitud_SOL-CRE-\d{4}-\d{6}\.pdf/);
      expect(res.body.length).toBeGreaterThan(1000);
    });

    test('el asesor también puede descargarlo y otro cliente no (403)', async () => {
      const advisorRes = await request(app)
        .get(`/api/credit-applications/${applicationId}/pdf`)
        .set('Authorization', `Bearer ${advisorToken}`);
      expect(advisorRes.status).toBe(200);

      const stranger = await User.create({
        nombre: 'Cliente Ajeno',
        email: 'cliente.ajeno@test.local',
        password: 'Cliente123!',
        rol: 'CLIENTE',
      });
      const strangerRes = await request(app)
        .get(`/api/credit-applications/${applicationId}/pdf`)
        .set('Authorization', `Bearer ${generateTestToken(stranger)}`);
      expect(strangerRes.status).toBe(403);
    });

    test('el historial del cliente incluye simulaciones de crédito e inversión', async () => {
      await request(app)
        .post('/api/simulations/investments')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ investmentProductId: investmentProduct.id, amount: 5000, termDays: 180 });

      const res = await request(app)
        .get('/api/simulations/my')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.simulations.length).toBeGreaterThan(0);
      expect(res.body.data.investmentSimulations.length).toBeGreaterThan(0);
    });
  });

  describe('Flujo de estados de la solicitud', () => {
    let applicationId;

    beforeAll(async () => {
      const simRes = await request(app)
        .post('/api/simulations/credits')
        .send({ creditTypeId: creditProduct.id, amount: 3000, termMonths: 12, amortizationSystem: 'ALEMAN' });
      const simulation = simRes.body.data.simulation;
      const res = await request(app)
        .post('/api/credit-applications')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          simulationId: simulation.id,
          creditTypeId: simulation.creditTypeId,
          monto: simulation.monto,
          plazoMeses: simulation.plazoMeses,
          sistemaAmortizacion: simulation.sistemaAmortizacion,
          nombres: 'Carlos',
          apellidos: 'Mendoza',
          cedula: '1723456784',
          direccion: 'Av. 10 de Agosto y Colón',
          ciudad: 'Quito',
          telefono: '0998877665',
          email: 'carlos@cliente.local',
          fechaNacimiento: '1990-05-15',
          actividadEconomica: 'Empleado privado',
          ingresosMensuales: 1500,
          egresosMensuales: 600,
          autorizaConsultaBuro: true,
        });
      applicationId = res.body.data.application.id;
    });

    const patchStatus = (body) => request(app)
      .patch(`/api/admin/applications/${applicationId}/status`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send(body);

    test('no se puede aprobar sin pasar por revisión', async () => {
      const res = await patchStatus({ estado: 'APROBADA', biometriaValidada: true });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/pendiente no puede pasar a aprobada/);
    });

    test('rechazar exige una observación para el cliente', async () => {
      const res = await patchStatus({ estado: 'RECHAZADA' });
      expect(res.status).toBe(400);
      expect(res.body.errors.observacionAsesor).toBeDefined();
    });

    test('una solicitud rechazada queda cerrada: no cambia de estado ni recibe documentos', async () => {
      const rejected = await patchStatus({ estado: 'RECHAZADA', observacionAsesor: 'Capacidad de pago insuficiente.' });
      expect(rejected.status).toBe(200);

      const reopen = await patchStatus({ estado: 'EN_REVISION' });
      expect(reopen.status).toBe(400);
      expect(reopen.body.message).toMatch(/ya fue rechazada/);

      const upload = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${clientToken}`)
        .field('tipo', 'CEDULA')
        .field('creditApplicationId', applicationId)
        .attach('archivo', Buffer.from('cedula'), 'cedula.png');
      expect(upload.status).toBe(400);
    });
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
      cedula: '1723456784',
      direccion: 'Av. 10 de Agosto y Colón',
      ciudad: 'Quito',
      telefono: '0998877665',
      email: 'carlos@cliente.local',
      actividadEconomica: 'Empleado bajo relación de dependencia',
      ingresosMensuales: 1500,
      origenFondos: 'Ahorros laborales',
      finalidadInversion: 'Ahorro para estudios de posgrado',
      declaraLicitudFondos: true,
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
        cedula: '1723456784',
        telefono: '0998877665',
        email: 'carlos@cliente.local',
        actividadEconomica: 'Empleado bajo relación de dependencia',
        ingresosMensuales: 1500,
        origenFondos: 'Ahorros laborales',
        finalidadInversion: 'Fondo para estudios',
        declaraLicitudFondos: true,
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

  test('el asesor aprueba la inversión con los documentos validados y la identidad verificada', async () => {
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

    // El análisis es previo a la aprobación
    const review = await request(app)
      .patch(`/api/admin/applications/${investmentApplicationId}/status`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ tipo: 'INVERSION', estado: 'EN_REVISION' });
    expect(review.status).toBe(200);

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
  });
});
