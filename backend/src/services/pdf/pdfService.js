const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatMoney, formatPercent } = require('../../utils/money');
const { formatDisplayDate, todayISO } = require('../../utils/dates');
const { getFrequency } = require('../amortization/frequencies');

const PAGE_MARGIN = 40;
const CONTENT_WIDTH = 515; // A4 (595 pt) menos márgenes
const PAGE_BOTTOM = 780;
const DARK = '#1e293b';
const GRAY = '#64748b';
const BORDER = '#e2e8f0';

const SYSTEM_LABELS = {
  FRANCES: 'Cuota fija (sistema francés)',
  ALEMAN: 'Cuota decreciente (sistema alemán)',
};

const STATUS_LABELS = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  PENDIENTE_DOCUMENTOS: 'Documentos pendientes',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

/**
 * Logotipo institucional: el subido por el administrador (/uploads/...) o, si es el logo por
 * defecto, la copia incluida en backend/assets.
 */
function resolveInstitutionLogo(logo) {
  if (!logo) return null;

  let pathname = logo;
  try {
    pathname = new URL(logo).pathname;
  } catch (_error) {
    // Las rutas relativas, como /uploads/logo.png, son el formato esperado.
  }

  const fileName = path.basename(pathname);
  const candidates = pathname.startsWith('/uploads/')
    ? [path.resolve(__dirname, '../../../uploads', fileName)]
    : [path.resolve(__dirname, '../../../assets', fileName)];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function createDocument(outputStream) {
  const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4', bufferPages: true });
  doc.pipe(outputStream);
  return doc;
}

function drawHeader(doc, institution, subtitle, color) {
  doc.rect(PAGE_MARGIN, PAGE_MARGIN, CONTENT_WIDTH, 60).fill(color);

  let textX = PAGE_MARGIN + 15;
  const logoPath = resolveInstitutionLogo(institution?.logo);
  if (logoPath) {
    try {
      // Fondo claro para que el logotipo se lea sobre el color institucional
      doc.roundedRect(PAGE_MARGIN + 8, PAGE_MARGIN + 8, 120, 44, 4).fill('#ffffff');
      doc.image(logoPath, PAGE_MARGIN + 14, PAGE_MARGIN + 12, { fit: [108, 36], align: 'center', valign: 'center' });
      textX = PAGE_MARGIN + 142;
    } catch (_error) {
      // Si la imagen no se puede leer se muestra solo el nombre
    }
  }

  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16)
    .text(institution?.nombre || 'FinanEcuador Demo', textX, PAGE_MARGIN + 12, { width: CONTENT_WIDTH - (textX - PAGE_MARGIN) - 10 });
  doc.font('Helvetica').fontSize(9)
    .text(`${subtitle} | RUC: ${institution?.ruc || '—'} | Tel: ${institution?.telefono || '—'}`, textX, PAGE_MARGIN + 36);
}

function drawTitle(doc, title, reference, y) {
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(13)
    .text(title, PAGE_MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
  doc.fillColor(GRAY).font('Helvetica-Oblique').fontSize(8.5)
    .text(`Generado el ${formatDisplayDate(todayISO())} · ${reference}`, PAGE_MARGIN, y + 18, { width: CONTENT_WIDTH, align: 'center' });
  return y + 38;
}

function drawSectionTitle(doc, text, y) {
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text(text, PAGE_MARGIN, y);
  return y + 16;
}

/**
 * Pares etiqueta/valor en dos columnas dentro de un recuadro
 */
function drawKeyValueBox(doc, columns, y) {
  const rowHeight = 15;
  const rows = Math.max(...columns.map((column) => column.length));
  const height = rows * rowHeight + 16;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, height).lineWidth(1).strokeColor(BORDER).stroke();

  const padding = 12;
  const gap = 18;
  const columnWidth = (CONTENT_WIDTH - padding * 2 - gap * (columns.length - 1)) / columns.length;
  columns.forEach((items, columnIndex) => {
    const x = PAGE_MARGIN + padding + columnIndex * (columnWidth + gap);
    items.forEach(([label, value, strong], rowIndex) => {
      const rowY = y + 9 + rowIndex * rowHeight;
      doc.fillColor(GRAY).font('Helvetica').fontSize(8.5).text(label, x, rowY, { width: columnWidth * 0.5, lineBreak: false });
      doc.fillColor(DARK).font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
        .text(value, x + columnWidth * 0.5, rowY, { width: columnWidth * 0.5, align: 'right', lineBreak: false });
    });
  });
  return y + height + 12;
}

function drawNote(doc, title, text, y, colors) {
  doc.font('Helvetica').fontSize(8);
  const textHeight = doc.heightOfString(text, { width: CONTENT_WIDTH - 20 });
  const height = textHeight + 28;
  if (y + height > PAGE_BOTTOM) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, height).fill(colors.background);
  doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(8.5).text(title, PAGE_MARGIN + 10, y + 8);
  doc.font('Helvetica').fontSize(8).text(text, PAGE_MARGIN + 10, y + 20, { width: CONTENT_WIDTH - 20 });
  return y + height + 10;
}

function drawPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index++) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fillColor(GRAY).font('Helvetica').fontSize(7.5)
      .text(`Página ${index + 1} de ${range.count}`, PAGE_MARGIN, doc.page.height - 28, { width: CONTENT_WIDTH, align: 'right' });
    doc.page.margins.bottom = bottomMargin;
  }
}

// Columnas de la tabla de amortización (suman el ancho útil de la página)
const TABLE_COLUMNS = [
  { header: 'N°', width: 30, align: 'center', value: (row) => String(row.numeroCuota) },
  { header: 'Fecha de pago', width: 64, align: 'left', value: (row) => formatDisplayDate(row.fechaPago) },
  { header: 'Saldo inicial', width: 75, align: 'right', value: (row) => formatMoney(row.saldoInicial) },
  { header: 'Capital', width: 68, align: 'right', value: (row) => formatMoney(row.capital) },
  { header: 'Interés', width: 62, align: 'right', value: (row) => formatMoney(row.interes) },
  { header: 'Seguros', width: 58, align: 'right', value: (row) => formatMoney(row.cargos) },
  { header: 'Cuota a pagar', width: 78, align: 'right', value: (row) => formatMoney(row.totalPago), bold: true },
  { header: 'Saldo final', width: 80, align: 'right', value: (row) => formatMoney(row.saldoFinal) },
];

function drawTableRow(doc, values, y, { background, bold = false, color = DARK, fontSize = 7.5, height = 14 } = {}) {
  if (background) {
    doc.rect(PAGE_MARGIN, y - 3, CONTENT_WIDTH, height).fill(background);
  }
  let x = PAGE_MARGIN;
  TABLE_COLUMNS.forEach((column, index) => {
    const isBold = bold || column.bold;
    doc.fillColor(color).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
      .text(values[index], x + 3, y, { width: column.width - 6, align: column.align, lineBreak: false });
    x += column.width;
  });
}

function drawAmortizationTable(doc, rows, totals, y) {
  const drawHeaderRow = (rowY) => drawTableRow(
    doc,
    TABLE_COLUMNS.map((column) => column.header),
    rowY,
    { background: '#0b2545', bold: true, color: '#ffffff', fontSize: 7.5, height: 18 }
  );

  // No empezar la tabla al pie de la página
  if (y > PAGE_BOTTOM - 60) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  drawHeaderRow(y);
  y += 20;

  rows.forEach((row, index) => {
    if (y > PAGE_BOTTOM - 14) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawHeaderRow(y);
      y += 20;
    }
    drawTableRow(doc, TABLE_COLUMNS.map((column) => column.value(row)), y, {
      background: index % 2 === 1 ? '#f8fafc' : null,
    });
    y += 14;
  });

  if (y > PAGE_BOTTOM - 18) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  drawTableRow(
    doc,
    ['', 'Totales', '', formatMoney(totals.capital), formatMoney(totals.interes), formatMoney(totals.cargos), formatMoney(totals.totalPago), formatMoney(0)],
    y + 2,
    { background: '#e6eeff', bold: true, height: 18 }
  );
  return y + 26;
}

function sumRows(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

/**
 * PDF de una simulación o solicitud de crédito: hoja de resumen y tabla de amortización
 * @param {Object} data
 * @param {Object} data.institution - Datos de la institución
 * @param {Object} data.simulation - Simulación (con creditType)
 * @param {Array} data.rows - Filas de la tabla de amortización
 * @param {Object} [data.application] - Solicitud, si el PDF corresponde a una solicitud
 * @param {stream.Writable} outputStream - Stream donde escribir el PDF
 */
function generateCreditSimulationPDF({ institution, simulation, rows, application }, outputStream) {
  const doc = createDocument(outputStream);
  const color = institution?.colorPrincipal || '#0f766e';

  drawHeader(doc, institution, 'Crédito', color);
  const reference = application ? `Solicitud ${application.codigo}` : `Simulación ${String(simulation.id).slice(0, 8)}`;
  let y = drawTitle(doc, application ? 'SOLICITUD DE CRÉDITO Y TABLA DE AMORTIZACIÓN' : 'SIMULACIÓN DE CRÉDITO Y TABLA DE AMORTIZACIÓN', reference, 115);

  if (application) {
    y = drawSectionTitle(doc, 'Datos del solicitante', y);
    y = drawKeyValueBox(doc, [
      [
        ['Nombre', `${application.nombres} ${application.apellidos}`],
        ['Cédula', application.cedula],
        ['Teléfono', application.telefono],
      ],
      [
        ['Solicitud', application.codigo],
        ['Estado', STATUS_LABELS[application.estado] || application.estado],
        ['Fecha de registro', formatDisplayDate(new Date(application.createdAt))],
      ],
    ], y);
  }

  const cargosDesembolso = Number(simulation.cargosDesembolso || 0);
  const montoLiquido = simulation.montoLiquido != null
    ? Number(simulation.montoLiquido)
    : Number(simulation.monto) - cargosDesembolso;
  const tasaNominal = simulation.tasaNominal != null
    ? Number(simulation.tasaNominal)
    : 12 * (Math.pow(1 + Number(simulation.tasaAnual) / 100, 1 / 12) - 1) * 100;
  const seguros = sumRows(rows, 'cargos');
  const frecuencia = getFrequency(simulation.frecuenciaPago || 'MENSUAL');

  y = drawSectionTitle(doc, 'Condiciones del crédito', y);
  y = drawKeyValueBox(doc, [
    [
      ['Producto', simulation.creditType?.nombre || 'Crédito'],
      ['Monto solicitado', formatMoney(simulation.monto)],
      ['Retenido al desembolso', formatMoney(cargosDesembolso)],
      ['Valor a recibir', formatMoney(montoLiquido), true],
      ['Plazo', `${simulation.plazoMeses} meses · ${rows.length} cuotas ${frecuencia.cuota}es`],
      ['Tipo de cuota', SYSTEM_LABELS[simulation.sistemaAmortizacion] || simulation.sistemaAmortizacion],
      ['Fecha de desembolso', formatDisplayDate(simulation.fechaInicio)],
    ],
    [
      ['Tasa nominal anual', formatPercent(tasaNominal)],
      ['Tasa efectiva anual (TEA)', formatPercent(simulation.tasaAnual)],
      ['Primera cuota', formatMoney(rows[0]?.totalPago ?? simulation.cuotaInicial), true],
      ['Total de intereses', formatMoney(simulation.totalIntereses)],
      ['Total de seguros', simulation.polizaDesgravamenPropia ? `${formatMoney(seguros)} (póliza propia)` : formatMoney(seguros)],
      ['Total a pagar en cuotas', formatMoney(simulation.totalPagar), true],
      ['Costo efectivo anual', simulation.costoEfectivoAnual != null ? formatPercent(simulation.costoEfectivoAnual) : '—'],
    ],
  ], y);

  const desglose = (simulation.desgloseCargos || []).filter((cargo) => Number(cargo.valor) > 0);
  if (desglose.length > 0) {
    y = drawSectionTitle(doc, 'Impuestos y seguros', y);
    desglose.forEach((cargo) => {
      const momento = cargo.momento === 'DESEMBOLSO' ? 'retenido al desembolso' : 'cobrado en las cuotas';
      doc.fillColor(DARK).font('Helvetica').fontSize(8.5)
        .text(`${cargo.nombre} (${momento})`, PAGE_MARGIN + 10, y, { width: 380, continued: false });
      doc.font('Helvetica-Bold').text(formatMoney(cargo.valor), PAGE_MARGIN + 390, y, { width: 115, align: 'right' });
      y += 14;
    });
    y += 8;
  }

  y = drawSectionTitle(doc, 'Tabla de amortización', y);
  y = drawAmortizationTable(doc, rows, {
    capital: simulation.totalCapital ?? sumRows(rows, 'capital'),
    interes: simulation.totalIntereses ?? sumRows(rows, 'interes'),
    cargos: seguros,
    totalPago: simulation.totalPagar ?? sumRows(rows, 'totalPago'),
  }, y);

  drawNote(
    doc,
    'INFORMACIÓN IMPORTANTE',
    'Valores referenciales: no constituyen aprobación ni contrato de crédito. Intereses calculados sobre saldos con base comercial de 360 días. '
      + 'La TEA no incluye la contribución SOLCA (0,5 % retenido al desembolso, anualizado si el plazo es menor a un año) ni los seguros; el costo efectivo anual sí los incluye. '
      + 'Puedes pagar por anticipado sin penalidad. Proyecto académico de la materia Ingeniería Económica.',
    y,
    { background: '#fffbeb', text: '#92400e' }
  );

  drawPageNumbers(doc);
  doc.end();
}

/**
 * PDF de una simulación o solicitud de depósito a plazo fijo
 */
/**
 * Tabla simple con encabezado repetido en cada página
 * @param {Array} columns - [{ header, width, align, value(row), bold }]
 */
function drawSimpleTable(doc, columns, items, y) {
  const drawRow = (values, rowY, { background, bold = false, color = DARK } = {}) => {
    if (background) doc.rect(PAGE_MARGIN, rowY - 3, CONTENT_WIDTH, 16).fill(background);
    let x = PAGE_MARGIN;
    columns.forEach((column, index) => {
      doc.fillColor(color).font(bold || column.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
        .text(values[index], x + 4, rowY, { width: column.width - 8, align: column.align, lineBreak: false });
      x += column.width;
    });
  };
  const drawHeaderRow = (rowY) => drawRow(columns.map((column) => column.header), rowY, { background: '#0b2545', bold: true, color: '#ffffff' });

  if (y > PAGE_BOTTOM - 60) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  drawHeaderRow(y);
  y += 18;
  items.forEach((item, index) => {
    if (y > PAGE_BOTTOM - 14) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawHeaderRow(y);
      y += 18;
    }
    drawRow(columns.map((column) => column.value(item)), y, { background: index % 2 === 1 ? '#f8fafc' : null });
    y += 15;
  });
  return y + 10;
}

/**
 * PDF de un plan de ahorro programado: aportes mensuales con interés capitalizable
 */
function generateSavingsPlanPDF({ institution, simulation, application }, outputStream) {
  const doc = createDocument(outputStream);
  const color = institution?.colorSecundario || '#0369a1';

  drawHeader(doc, institution, 'Ahorro programado', color);
  const reference = application ? `Solicitud ${application.codigo}` : `Simulación ${String(simulation.id).slice(0, 8)}`;
  let y = drawTitle(doc, application ? 'SOLICITUD DE AHORRO PROGRAMADO' : 'SIMULACIÓN DE AHORRO PROGRAMADO', reference, 115);

  if (application) {
    y = drawSectionTitle(doc, 'Datos del ahorrista', y);
    y = drawKeyValueBox(doc, [
      [['Nombre', `${application.nombres} ${application.apellidos}`], ['Cédula', application.cedula]],
      [['Solicitud', application.codigo], ['Estado', STATUS_LABELS[application.estado] || application.estado]],
    ], y);
  }

  const pagos = simulation.cronogramaPagos || [];
  const retencion = Number(simulation.retencionIR || 0);
  y = drawSectionTitle(doc, 'Condiciones del plan', y);
  y = drawKeyValueBox(doc, [
    [
      ['Producto', simulation.product?.nombre || 'Ahorro programado'],
      ['Aporte mensual', formatMoney(simulation.aporteMensual), true],
      ['Número de aportes', `${pagos.length} meses`],
      ['Primer aporte', formatDisplayDate(simulation.fechaInicio)],
      ['Fin del plan', formatDisplayDate(simulation.fechaVencimiento)],
    ],
    [
      ['Tasa nominal anual', formatPercent(simulation.tasaAnual)],
      ['Tasa efectiva anual (TEA)', simulation.tasaEfectiva != null ? formatPercent(simulation.tasaEfectiva) : '—'],
      ['Total aportado', formatMoney(simulation.monto)],
      ['Intereses ganados', formatMoney(simulation.interesGanado)],
      ['Retención Impuesto a la Renta', retencion > 0 ? `-${formatMoney(retencion)}` : 'Exento'],
    ],
  ], y);

  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 34).fill('#e6eeff');
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text('VALOR A RECIBIR AL FINAL DEL PLAN', PAGE_MARGIN + 12, y + 11);
  doc.text(formatMoney(simulation.valorFinal), PAGE_MARGIN + 300, y + 11, { width: CONTENT_WIDTH - 312, align: 'right' });
  y += 46;

  if (pagos.length > 0) {
    y = drawSectionTitle(doc, 'Aportes y saldo acumulado', y);
    y = drawSimpleTable(doc, [
      { header: 'Mes', width: 50, align: 'center', value: (pago) => String(pago.numero) },
      { header: 'Fecha de aporte', width: 115, align: 'left', value: (pago) => formatDisplayDate(pago.fecha) },
      { header: 'Aporte', width: 110, align: 'right', value: (pago) => formatMoney(pago.aporte) },
      { header: 'Interés del mes', width: 110, align: 'right', value: (pago) => formatMoney(pago.interes) },
      { header: 'Saldo', width: 130, align: 'right', value: (pago) => formatMoney(pago.saldo), bold: true },
    ], pagos, y);
  }

  drawNote(
    doc,
    'CONDICIONES DE LA SIMULACIÓN',
    'Aportes al inicio de cada mes; el saldo capitaliza intereses mensualmente con la tasa nominal anual / 12. '
      + 'Se aplica la regla de retención del Impuesto a la Renta de los depósitos a plazo (3 % si el plan dura menos de 180 días). '
      + 'Valores referenciales, no constituyen contrato. Proyecto académico de la materia Ingeniería Económica.',
    y,
    { background: '#f0fdf4', text: '#166534' }
  );

  drawPageNumbers(doc);
  doc.end();
}

function generateInvestmentSimulationPDF({ institution, simulation, application }, outputStream) {
  if (simulation.aporteMensual != null) {
    generateSavingsPlanPDF({ institution, simulation, application }, outputStream);
    return;
  }

  const doc = createDocument(outputStream);
  const color = institution?.colorSecundario || '#0369a1';

  drawHeader(doc, institution, 'Depósito a plazo fijo', color);
  const reference = application ? `Solicitud ${application.codigo}` : `Simulación ${String(simulation.id).slice(0, 8)}`;
  let y = drawTitle(doc, application ? 'SOLICITUD DE INVERSIÓN A PLAZO FIJO' : 'SIMULACIÓN DE INVERSIÓN A PLAZO FIJO', reference, 115);

  if (application) {
    y = drawSectionTitle(doc, 'Datos del inversionista', y);
    y = drawKeyValueBox(doc, [
      [
        ['Nombre', `${application.nombres} ${application.apellidos}`],
        ['Cédula', application.cedula],
      ],
      [
        ['Solicitud', application.codigo],
        ['Estado', STATUS_LABELS[application.estado] || application.estado],
      ],
    ], y);
  }

  const interes = Number(simulation.interesGanado || 0);
  const retencion = Number(simulation.retencionIR || 0);
  const interesNeto = simulation.interesNeto != null ? Number(simulation.interesNeto) : interes - retencion;

  y = drawSectionTitle(doc, 'Condiciones del depósito', y);
  y = drawKeyValueBox(doc, [
    [
      ['Producto', simulation.product?.nombre || 'Depósito a plazo fijo'],
      ['Capital invertido', formatMoney(simulation.monto)],
      ['Plazo', `${simulation.plazoDias} días`],
      ['Fecha de apertura', formatDisplayDate(simulation.fechaInicio)],
      ['Fecha de vencimiento', formatDisplayDate(simulation.fechaVencimiento)],
    ],
    [
      ['Tasa nominal anual', formatPercent(simulation.tasaAnual)],
      ['Tasa efectiva anual (TEA)', simulation.tasaEfectiva != null ? formatPercent(simulation.tasaEfectiva) : '—'],
      ['Interés ganado', formatMoney(interes)],
      ['Retención Impuesto a la Renta', retencion > 0 ? `-${formatMoney(retencion)}` : 'Exento'],
      ['Ganancia neta', formatMoney(interesNeto), true],
    ],
  ], y);

  const pagoMensual = simulation.pagoIntereses === 'MENSUAL';
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 34).fill('#e6eeff');
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
    .text(pagoMensual ? 'TOTAL A RECIBIR (CAPITAL + INTERESES NETOS)' : 'VALOR A RECIBIR AL VENCIMIENTO', PAGE_MARGIN + 12, y + 11);
  doc.text(formatMoney(simulation.valorFinal), PAGE_MARGIN + 300, y + 11, { width: CONTENT_WIDTH - 312, align: 'right' });
  y += 46;

  const pagos = simulation.cronogramaPagos || [];
  if (pagoMensual && pagos.length > 0) {
    y = drawSectionTitle(doc, 'Pagos de intereses cada 30 días', y);
    const columns = [
      { header: 'N°', width: 40, align: 'center', value: (pago) => String(pago.numero) },
      { header: 'Fecha', width: 90, align: 'left', value: (pago) => formatDisplayDate(pago.fecha) },
      { header: 'Días', width: 55, align: 'right', value: (pago) => String(pago.dias) },
      { header: 'Interés', width: 80, align: 'right', value: (pago) => formatMoney(pago.interes) },
      { header: 'Retención', width: 80, align: 'right', value: (pago) => formatMoney(pago.retencion) },
      { header: 'Capital', width: 80, align: 'right', value: (pago) => formatMoney(pago.capital) },
      { header: 'Recibes', width: 90, align: 'right', value: (pago) => formatMoney(pago.totalRecibido), bold: true },
    ];
    const drawRow = (values, rowY, { background, bold = false, color = DARK } = {}) => {
      if (background) doc.rect(PAGE_MARGIN, rowY - 3, CONTENT_WIDTH, 16).fill(background);
      let x = PAGE_MARGIN;
      columns.forEach((column, index) => {
        doc.fillColor(color).font(bold || column.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
          .text(values[index], x + 4, rowY, { width: column.width - 8, align: column.align, lineBreak: false });
        x += column.width;
      });
    };
    const drawHeaderRow = (rowY) => drawRow(columns.map((column) => column.header), rowY, { background: '#0b2545', bold: true, color: '#ffffff' });

    drawHeaderRow(y);
    y += 18;
    pagos.forEach((pago, index) => {
      if (y > PAGE_BOTTOM - 14) {
        doc.addPage();
        y = PAGE_MARGIN;
        drawHeaderRow(y);
        y += 18;
      }
      drawRow(columns.map((column) => column.value(pago)), y, { background: index % 2 === 1 ? '#f8fafc' : null });
      y += 15;
    });
    y += 10;
  }

  drawNote(
    doc,
    'CONDICIONES DE LA SIMULACIÓN',
    `Interés simple con base comercial de 360 días, ${pagoMensual ? 'pagado cada 30 días; el capital se devuelve al vencimiento' : 'pagado al vencimiento'}. Se retiene el 3 % de los intereses como Impuesto a la Renta `
      + 'cuando el plazo es menor a 180 días; desde 180 días están exentos. El seguro de depósitos COSEDE cubre hasta $32.000 por persona en cada entidad. '
      + 'Valores referenciales, no constituyen contrato. Proyecto académico de la materia Ingeniería Económica.',
    y,
    { background: '#f0fdf4', text: '#166534' }
  );

  drawPageNumbers(doc);
  doc.end();
}

module.exports = {
  generateCreditSimulationPDF,
  generateInvestmentSimulationPDF,
};
