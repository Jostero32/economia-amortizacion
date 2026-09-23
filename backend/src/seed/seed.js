const bcrypt = require('bcryptjs');
const {
  Institution,
  User,
  CreditSegment,
  CreditType,
  CreditRate,
  Charge,
  InvestmentProduct,
  InvestmentRate,
} = require('../models');

async function seedDatabase() {
  console.log('--- Iniciando carga de semilla de datos (Seed) ---');

  // 1. Institución Ficticia
  const institutionCount = await Institution.count();
  if (institutionCount === 0) {
    await Institution.create({
      nombre: 'FinanEcuador Demo',
      tipo: 'BANCO_PRIVADO',
      ruc: '1790012345001',
      logo: '/LogoFinanEcuador.png',
      direccion: 'Av. Amazonas y Naciones Unidas, Edificio Financiero, Quito, Ecuador',
      telefono: '02-2999-999',
      email: 'contacto@finanecuador.local',
      sitioWeb: 'https://finanecuador.demo',
      colorPrincipal: '#0f766e',
      colorSecundario: '#0369a1',
      activo: true,
    });
    console.log('[Seed] Institución "FinanEcuador Demo" creada exitosamente.');
  } else {
    const institution = await Institution.findOne({ where: { activo: true } });
    if (institution && !institution.logo) {
      await institution.update({ logo: '/LogoFinanEcuador.png' });
      console.log('[Seed] Logo institucional predeterminado restaurado.');
    }
  }

  // 2. Usuarios de Demostración
  const usersToCreate = [
    {
      nombre: 'Administrador General',
      email: 'admin@finanecuador.local',
      password: 'Admin123!',
      rol: 'ADMIN',
      cedula: '1710000001',
      telefono: '0991112233',
    },
    {
      nombre: 'Asesor de Crédito',
      email: 'asesor@finanecuador.local',
      password: 'Asesor123!',
      rol: 'ASESOR',
      cedula: '1710000002',
      telefono: '0992223344',
    },
    {
      nombre: 'Cliente de Prueba',
      email: 'cliente@finanecuador.local',
      password: 'Cliente123!',
      rol: 'CLIENTE',
      cedula: '1710000003',
      telefono: '0993334455',
    },
  ];

  for (const u of usersToCreate) {
    const exists = await User.findOne({ where: { email: u.email } });
    if (!exists) {
      await User.create(u);
      console.log(`[Seed] Usuario ${u.rol} (${u.email}) creado.`);
    }
  }

  // 3. Segmentos Oficiales del Banco Central del Ecuador (Septiembre 2026)
  const segmentsData = [
    { codigo: 'CONSUMO', nombre: 'Consumo', tasaMaxima: 16.77, tasaReferencial: 15.74 },
    { codigo: 'EDUCATIVO', nombre: 'Educativo', tasaMaxima: 9.50, tasaReferencial: 8.83 },
    { codigo: 'EDUCATIVO_SOCIAL', nombre: 'Educativo Social', tasaMaxima: 7.50, tasaReferencial: 5.49 },
    { codigo: 'VIVIENDA_VIP', nombre: 'Vivienda de Interés Público', tasaMaxima: 4.99, tasaReferencial: 4.99 },
    { codigo: 'VIVIENDA_VIS', nombre: 'Vivienda de Interés Social', tasaMaxima: 4.99, tasaReferencial: 4.99 },
    { codigo: 'INMOBILIARIO', nombre: 'Inmobiliario', tasaMaxima: 9.26, tasaReferencial: 8.55 },
    { codigo: 'MICRO_MINORISTA', nombre: 'Microcrédito Minorista', tasaMaxima: 28.23, tasaReferencial: 19.65 },
    { codigo: 'MICRO_ACUM_SIMPLE', nombre: 'Microcrédito Acumulación Simple', tasaMaxima: 24.89, tasaReferencial: 20.74 },
    { codigo: 'MICRO_ACUM_AMPLIADA', nombre: 'Microcrédito Acumulación Ampliada', tasaMaxima: 22.05, tasaReferencial: 18.53 },
    { codigo: 'PROD_PYMES', nombre: 'Productivo PYMES', tasaMaxima: 10.15, tasaReferencial: 8.98 },
    { codigo: 'PROD_EMPRESARIAL', nombre: 'Productivo Empresarial', tasaMaxima: 9.99, tasaReferencial: 9.05 },
    { codigo: 'PROD_CORPORATIVO', nombre: 'Productivo Corporativo', tasaMaxima: 7.72, tasaReferencial: 7.03 },
  ];

  const segmentMap = {};
  for (const s of segmentsData) {
    let [seg] = await CreditSegment.findOrCreate({
      where: { codigo: s.codigo },
      defaults: {
        ...s,
        fuente: 'Banco Central del Ecuador',
        fechaVigencia: '2026-09-01',
        activo: true,
      },
    });
    segmentMap[s.codigo] = seg;
  }
  console.log('[Seed] 12 Segmentos BCE (Septiembre 2026) asegurados.');

  // 4. Productos de Crédito
  const creditTypesData = [
    {
      nombre: 'Crédito de Consumo',
      segmentCode: 'CONSUMO',
      descripcion: 'Préstamo para adquisición de bienes de consumo o libre disponibilidad. Tasa referencial BCE.',
      montoMinimo: 500,
      montoMaximo: 25000,
      plazoMinimo: 6,
      plazoMaximo: 48,
    },
    {
      nombre: 'Crédito Vehicular',
      segmentCode: 'CONSUMO', // Vehicular pertenece al segmento Consumo regulatoriamente
      descripcion: 'Financiamiento para adquisición de vehículos nuevos o usados. Segmento regulatorio: Consumo.',
      montoMinimo: 3000,
      montoMaximo: 40000,
      plazoMinimo: 12,
      plazoMaximo: 60,
    },
    {
      nombre: 'Crédito Educativo',
      segmentCode: 'EDUCATIVO',
      descripcion: 'Financiamiento de estudios de pregrado y posgrado con condiciones preferenciales.',
      montoMinimo: 1000,
      montoMaximo: 30000,
      plazoMinimo: 12,
      plazoMaximo: 72,
    },
    {
      nombre: 'Crédito Inmobiliario',
      segmentCode: 'INMOBILIARIO',
      descripcion: 'Préstamo hipotecario para adquisición, construcción o remodelación de vivienda.',
      montoMinimo: 15000,
      montoMaximo: 150000,
      plazoMinimo: 24,
      plazoMaximo: 240,
    },
    {
      nombre: 'Microcrédito',
      segmentCode: 'MICRO_MINORISTA',
      descripcion: 'Capital de trabajo para microempresas y emprendimientos de pequeña escala.',
      montoMinimo: 300,
      montoMaximo: 10000,
      plazoMinimo: 3,
      plazoMaximo: 36,
    },
  ];

  for (const ct of creditTypesData) {
    const seg = segmentMap[ct.segmentCode];
    if (seg) {
      let [creditType, created] = await CreditType.findOrCreate({
        where: { nombre: ct.nombre },
        defaults: {
          nombre: ct.nombre,
          descripcion: ct.descripcion,
          segmentId: seg.id,
          tasaInstitucion: seg.tasaReferencial, // Tasa referencial inicial
          montoMinimo: ct.montoMinimo,
          montoMaximo: ct.montoMaximo,
          plazoMinimo: ct.plazoMinimo,
          plazoMaximo: ct.plazoMaximo,
          activo: true,
        },
      });

      if (created) {
        // Registrar tasa con vigencia histórica
        await CreditRate.create({
          creditTypeId: creditType.id,
          tasa: seg.tasaReferencial,
          fechaVigencia: '2026-09-01',
          fuente: 'Basada en tasa referencial BCE (Valor demostrativo)',
          activo: true,
        });
      }
    }
  }
  console.log('[Seed] Productos de crédito y tasas históricas asegurados.');

  // 5. Cobros Adicionales (SOLCA y Desgravamen)
  const solcaExists = await Charge.findOne({ where: { nombre: 'Contribución SOLCA' } });
  if (!solcaExists) {
    await Charge.create({
      nombre: 'Contribución SOLCA',
      tipo: 'PORCENTAJE',
      valor: 0.00,
      porcentaje: 0.5000, // 0.50%
      baseCalculo: 'MONTO_OPERACION',
      aplicacion: 'UNA_VEZ',
      obligatorio: true,
      creditTypeId: null, // Aplica a todos los créditos
      descripcion: 'Contribución del 0,5% sobre la operación de crédito, conforme al marco legal aplicable.',
      activo: true,
    });
    console.log('[Seed] Cobro "Contribución SOLCA" (0.50% una sola vez) registrado.');
  }

  const desgravamenExists = await Charge.findOne({ where: { nombre: 'Seguro de Desgravamen' } });
  if (!desgravamenExists) {
    await Charge.create({
      nombre: 'Seguro de Desgravamen',
      tipo: 'PORCENTAJE',
      valor: 0.00,
      porcentaje: 0.0500, // 0.05% mensual sobre saldo insoluto
      baseCalculo: 'SALDO_INSOLUTO',
      aplicacion: 'MENSUAL',
      obligatorio: false,
      creditTypeId: null,
      descripcion: 'Seguro de desgravamen configurable para protección del crédito en caso de fallecimiento (Valor demostrativo).',
      activo: true,
    });
    console.log('[Seed] Cobro "Seguro de Desgravamen" configurable registrado.');
  }

  // 6. Inversiones a Plazo Fijo y Tasas BCE
  const [invProduct] = await InvestmentProduct.findOrCreate({
    where: { nombre: 'Depósito a Plazo Fijo' },
    defaults: {
      nombre: 'Depósito a Plazo Fijo',
      descripcion: 'Inversión a plazo fijo con rendimiento garantizado según tramo de días conforme a tasas referenciales BCE.',
      montoMinimo: 500,
      montoMaximo: 500000,
      plazoMinimoDias: 30,
      plazoMaximoDias: 1080,
      tasa: 5.09,
      fuente: 'Banco Central del Ecuador',
      fechaVigencia: '2026-09-01',
      activo: true,
    },
  });

  const investmentRatesData = [
    { plazoMinDias: 30, plazoMaxDias: 60, tasa: 4.03 },
    { plazoMinDias: 61, plazoMaxDias: 90, tasa: 4.40 },
    { plazoMinDias: 91, plazoMaxDias: 120, tasa: 4.41 },
    { plazoMinDias: 121, plazoMaxDias: 180, tasa: 4.46 },
    { plazoMinDias: 181, plazoMaxDias: 360, tasa: 5.09 },
    { plazoMinDias: 361, plazoMaxDias: 1080, tasa: 6.26 },
  ];

  for (const ir of investmentRatesData) {
    await InvestmentRate.findOrCreate({
      where: {
        investmentProductId: invProduct.id,
        plazoMinDias: ir.plazoMinDias,
        plazoMaxDias: ir.plazoMaxDias,
      },
      defaults: {
        ...ir,
        investmentProductId: invProduct.id,
        fuente: 'Banco Central del Ecuador',
        fechaVigencia: '2026-09-01',
        activo: true,
      },
    });
  }
  console.log('[Seed] Producto de inversión y tramos de tasas BCE asegurados.');
  console.log('--- Carga de semilla finalizada con éxito ---');
}

module.exports = { seedDatabase };
