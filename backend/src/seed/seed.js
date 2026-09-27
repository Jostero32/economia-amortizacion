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
      cedula: '1710000017',
      telefono: '0991112233',
    },
    {
      nombre: 'Asesor de Crédito',
      email: 'asesor@finanecuador.local',
      password: 'Asesor123!',
      rol: 'ASESOR',
      cedula: '1710000025',
      telefono: '0992223344',
    },
    {
      nombre: 'Cliente de Prueba',
      email: 'cliente@finanecuador.local',
      password: 'Cliente123!',
      rol: 'CLIENTE',
      cedula: '1710000033',
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
    {
      nombre: 'Crédito Emergente',
      segmentCode: 'CONSUMO',
      descripcion: 'Préstamo de consumo a corto plazo para imprevistos. Plazo menor a un año: la contribución SOLCA se anualiza. (Valores demostrativos)',
      montoMinimo: 300,
      montoMaximo: 3000,
      plazoMinimo: 3,
      plazoMaximo: 11,
    },
    {
      nombre: 'Crédito Educativo Social',
      segmentCode: 'EDUCATIVO_SOCIAL',
      descripcion: 'Financiamiento de estudios para personas de menores ingresos con tasa preferencial. (Valores demostrativos)',
      montoMinimo: 500,
      montoMaximo: 15000,
      plazoMinimo: 12,
      plazoMaximo: 60,
    },
    {
      nombre: 'Vivienda de Interés Social (VIS)',
      segmentCode: 'VIVIENDA_VIS',
      descripcion: 'Compra de primera vivienda de interés social con tasa preferencial. Incluye seguro de desgravamen obligatorio. (Valores demostrativos)',
      montoMinimo: 15000,
      montoMaximo: 80000,
      plazoMinimo: 60,
      plazoMaximo: 300,
    },
    {
      nombre: 'Vivienda de Interés Público (VIP)',
      segmentCode: 'VIVIENDA_VIP',
      descripcion: 'Compra de primera vivienda de interés público con tasa preferencial. Incluye seguro de desgravamen obligatorio. (Valores demostrativos)',
      montoMinimo: 30000,
      montoMaximo: 110000,
      plazoMinimo: 60,
      plazoMaximo: 300,
    },
    {
      nombre: 'Microcrédito de Acumulación Simple',
      segmentCode: 'MICRO_ACUM_SIMPLE',
      descripcion: 'Capital de trabajo y activos para negocios en crecimiento. (Valores demostrativos)',
      montoMinimo: 1000,
      montoMaximo: 20000,
      plazoMinimo: 6,
      plazoMaximo: 48,
    },
    {
      nombre: 'Microcrédito de Acumulación Ampliada',
      segmentCode: 'MICRO_ACUM_AMPLIADA',
      descripcion: 'Financiamiento para microempresas consolidadas con mayores ventas. (Valores demostrativos)',
      montoMinimo: 5000,
      montoMaximo: 50000,
      plazoMinimo: 12,
      plazoMaximo: 60,
    },
    {
      nombre: 'Crédito Productivo PYMES',
      segmentCode: 'PROD_PYMES',
      descripcion: 'Capital de trabajo y activos fijos para pequeñas y medianas empresas. (Valores demostrativos)',
      montoMinimo: 5000,
      montoMaximo: 250000,
      plazoMinimo: 12,
      plazoMaximo: 84,
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
  const solcaData = {
    nombre: 'Contribución SOLCA',
    categoria: 'IMPUESTO',
    tipo: 'PORCENTAJE',
    valor: 0.00,
    porcentaje: 0.5000, // 0.50%
    baseCalculo: 'MONTO_OPERACION',
    aplicacion: 'UNA_VEZ', // Retenida al desembolso
    anualizarSiPlazoMenorAnio: true,
    obligatorio: true,
    creditTypeId: null, // Aplica a todos los créditos
    descripcion: 'Contribución del 0,5 % sobre el monto del crédito, retenida al desembolso. Si el plazo es menor a un año se calcula de forma anualizada (monto × 0,5 % × días/360).',
    activo: true,
  };
  const solca = await Charge.findOne({ where: { nombre: solcaData.nombre } });
  if (!solca) {
    await Charge.create(solcaData);
    console.log('[Seed] Cobro "Contribución SOLCA" (0.50% al desembolso) registrado.');
  } else if (solca.categoria !== 'IMPUESTO') {
    // Bases creadas antes de clasificar los cargos
    await solca.update({
      categoria: 'IMPUESTO',
      anualizarSiPlazoMenorAnio: true,
      descripcion: solcaData.descripcion,
    });
    console.log('[Seed] Cobro "Contribución SOLCA" clasificado como impuesto de ley anualizable.');
  }

  const desgravamenData = {
    nombre: 'Seguro de Desgravamen',
    categoria: 'SEGURO_DESGRAVAMEN',
    tipo: 'PORCENTAJE',
    valor: 0.00,
    porcentaje: 0.0500, // 0.05% mensual sobre saldo insoluto
    baseCalculo: 'SALDO_INSOLUTO',
    aplicacion: 'MENSUAL',
    obligatorio: false, // Opcional salvo en créditos de vivienda
    creditTypeId: null,
    descripcion: 'Prima mensual sobre el saldo de capital (valor demostrativo). Obligatorio en créditos de vivienda; en los demás lo decide el cliente.',
    activo: true,
  };
  const desgravamen = await Charge.findOne({ where: { nombre: desgravamenData.nombre } });
  if (!desgravamen) {
    await Charge.create(desgravamenData);
    console.log('[Seed] Cobro "Seguro de Desgravamen" configurable registrado.');
  } else if (desgravamen.categoria !== 'SEGURO_DESGRAVAMEN') {
    await desgravamen.update({
      categoria: 'SEGURO_DESGRAVAMEN',
      descripcion: desgravamenData.descripcion,
    });
    console.log('[Seed] Cobro "Seguro de Desgravamen" clasificado como seguro de desgravamen.');
  }

  // 6. Inversiones a Plazo Fijo y tramos de tasas por plazo
  const investmentProductsData = [
    {
      nombre: 'Depósito a Plazo Fijo',
      descripcion: 'Inversión a plazo fijo con rendimiento según el tramo de días; capital e intereses se pagan al vencimiento.',
      montoMinimo: 500,
      montoMaximo: 500000,
      plazoMinimoDias: 30,
      plazoMaximoDias: 1080,
      tasa: 5.09,
      pagoIntereses: 'AL_VENCIMIENTO',
      rates: [
        { plazoMinDias: 30, plazoMaxDias: 60, tasa: 4.03 },
        { plazoMinDias: 61, plazoMaxDias: 90, tasa: 4.40 },
        { plazoMinDias: 91, plazoMaxDias: 120, tasa: 4.41 },
        { plazoMinDias: 121, plazoMaxDias: 180, tasa: 4.46 },
        { plazoMinDias: 181, plazoMaxDias: 360, tasa: 5.09 },
        { plazoMinDias: 361, plazoMaxDias: 1080, tasa: 6.26 },
      ],
    },
    {
      nombre: 'Depósito a Plazo con Pago Mensual',
      descripcion: 'Recibe tus intereses cada 30 días y tu capital al vencimiento. Tasa algo menor porque cobras los intereses antes. (Valores demostrativos)',
      montoMinimo: 5000,
      montoMaximo: 500000,
      plazoMinimoDias: 90,
      plazoMaximoDias: 1080,
      tasa: 4.85,
      pagoIntereses: 'MENSUAL',
      rates: [
        { plazoMinDias: 90, plazoMaxDias: 180, tasa: 4.20 },
        { plazoMinDias: 181, plazoMaxDias: 360, tasa: 4.85 },
        { plazoMinDias: 361, plazoMaxDias: 1080, tasa: 6.00 },
      ],
    },
    {
      nombre: 'Depósito a Plazo Fijo Plus',
      descripcion: 'Para montos desde $25.000, con tasas preferenciales en todos los plazos. (Valores demostrativos)',
      montoMinimo: 25000,
      montoMaximo: 1000000,
      plazoMinimoDias: 30,
      plazoMaximoDias: 1080,
      tasa: 5.44,
      pagoIntereses: 'AL_VENCIMIENTO',
      rates: [
        { plazoMinDias: 30, plazoMaxDias: 60, tasa: 4.38 },
        { plazoMinDias: 61, plazoMaxDias: 90, tasa: 4.75 },
        { plazoMinDias: 91, plazoMaxDias: 120, tasa: 4.76 },
        { plazoMinDias: 121, plazoMaxDias: 180, tasa: 4.81 },
        { plazoMinDias: 181, plazoMaxDias: 360, tasa: 5.44 },
        { plazoMinDias: 361, plazoMaxDias: 1080, tasa: 6.61 },
      ],
    },
  ];

  for (const { rates, ...productData } of investmentProductsData) {
    const [invProduct] = await InvestmentProduct.findOrCreate({
      where: { nombre: productData.nombre },
      defaults: {
        ...productData,
        fuente: 'Banco Central del Ecuador',
        fechaVigencia: '2026-09-01',
        activo: true,
      },
    });

    for (const ir of rates) {
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
  }
  console.log('[Seed] Productos de inversión y tramos de tasas asegurados.');
  console.log('--- Carga de semilla finalizada con éxito ---');
}

module.exports = { seedDatabase };
