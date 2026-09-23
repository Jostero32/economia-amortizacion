/**
 * SOURCE:
 * Banco Central del Ecuador (BCE)
 * Información de Tasas de Interés Efectivas Vigentes
 * Período: Septiembre 2026
 * URL Oficial: https://contenido.bce.fin.ec/documentos/Estadisticas/SectorMonFin/TasasInteres/Indice.htm
 *
 * Valores oficiales de tasas activas y pasivas referenciales y máximas del sistema financiero ecuatoriano.
 */

const BCE_RATES_SEPT_2026 = {
  fechaVigencia: '2026-09-01',
  periodo: 'Septiembre 2026',
  fuente: 'Banco Central del Ecuador',
  tasaPasivaReferencial: 4.99, // Tasa pasiva referencial BCE
  segmentos: [
    {
      codigo: 'CONSUMO',
      nombre: 'Crédito de Consumo',
      tasaReferencial: 15.74,
      tasaMaxima: 16.77,
      descripcion: 'Destinado a personas naturales para adquisición de bienes de consumo o pago de servicios.',
    },
    {
      codigo: 'EDUCATIVO',
      nombre: 'Educativo',
      tasaReferencial: 8.83,
      tasaMaxima: 9.50,
      descripcion: 'Destinado a estudios de educación superior y formación profesional.',
    },
    {
      codigo: 'EDUCATIVO_SOCIAL',
      nombre: 'Educativo Social',
      tasaReferencial: 5.49,
      tasaMaxima: 7.50,
      descripcion: 'Destinado a estudiantes con acreditación de vulnerabilidad socioeconómica.',
    },
    {
      codigo: 'VIP',
      nombre: 'Vivienda de Interés Público',
      tasaReferencial: 4.99,
      tasaMaxima: 4.99,
      descripcion: 'Crédito hipotecario con subsidio estatal para primera vivienda digna.',
    },
    {
      codigo: 'VIS',
      nombre: 'Vivienda de Interés Social',
      tasaReferencial: 4.99,
      tasaMaxima: 4.99,
      descripcion: 'Vivienda de interés social con tasa preferencial fija protegida.',
    },
    {
      codigo: 'INMOBILIARIO',
      nombre: 'Inmobiliario',
      tasaReferencial: 8.55,
      tasaMaxima: 9.26,
      descripcion: 'Crédito para compra, construcción o remodelación de bienes inmuebles.',
    },
    {
      codigo: 'MICRO_MINORISTA',
      nombre: 'Microcrédito Minorista',
      tasaReferencial: 19.65,
      tasaMaxima: 28.23,
      descripcion: 'Financiamiento a microempresarios o negocios populares.',
    },
    {
      codigo: 'PRODUCTIVO_PYMES',
      nombre: 'Productivo PYMES',
      tasaReferencial: 8.98,
      tasaMaxima: 10.15,
      descripcion: 'Crédito para capital de trabajo o activos fijos de pequeñas y medianas empresas.',
    },
    {
      codigo: 'PRODUCTIVO_EMPRESARIAL',
      nombre: 'Productivo Empresarial',
      tasaReferencial: 9.05,
      tasaMaxima: 9.99,
      descripcion: 'Financiamiento para medianas empresas comerciales y de producción.',
    },
    {
      codigo: 'PRODUCTIVO_CORPORATIVO',
      nombre: 'Productivo Corporativo',
      tasaReferencial: 7.03,
      tasaMaxima: 7.72,
      descripcion: 'Líneas de crédito para grandes corporaciones con altas ventas anuales.',
    },
  ],
};

module.exports = BCE_RATES_SEPT_2026;
