const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function resolveLocalInstitutionLogo(logo) {
  if (!logo) return null;

  let pathname = logo;
  try {
    pathname = new URL(logo).pathname;
  } catch (_error) {
    // Las rutas relativas, como /uploads/logo.png, son el formato esperado.
  }

  if (!pathname.startsWith('/uploads/')) return null;

  const uploadDir = path.resolve(__dirname, '../../../uploads');
  const logoPath = path.resolve(uploadDir, path.basename(pathname));
  if (!logoPath.startsWith(uploadDir) || !fs.existsSync(logoPath)) return null;
  return logoPath;
}

function drawInstitutionLogo(doc, institution, options = {}) {
  const logoPath = resolveLocalInstitutionLogo(institution?.logo);
  if (!logoPath) return false;

  try {
    doc.image(logoPath, options.x || 55, options.y || 48, {
      fit: [options.width || 90, options.height || 42],
      align: 'left',
      valign: 'center',
    });
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Genera el documento PDF para una simulación de crédito
 * @param {Object} data
 * @param {Object} data.institution - Datos de la institución
 * @param {Object} data.simulation - Datos de la simulación
 * @param {Array} data.rows - Filas de la tabla de amortización
 * @param {stream.Writable} outputStream - Stream donde escribir el PDF
 */
function generateCreditSimulationPDF({ institution, simulation, rows }, outputStream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(outputStream);

  const primaryColor = institution?.colorPrincipal || '#0f766e';
  const darkColor = '#1e293b';
  const grayColor = '#64748b';

  // Cabecera Institucional
  doc
    .rect(40, 40, 515, 60)
    .fill(primaryColor);

  const hasLogo = drawInstitutionLogo(doc, institution);
  const headerTextX = hasLogo ? 160 : 55;

  doc
    .fillColor('#ffffff')
    .fontSize(18)
    .font('Helvetica-Bold')
    .text(institution?.nombre || 'FinanEcuador Demo', headerTextX, 52);

  doc
    .fontSize(10)
    .font('Helvetica')
    .text(`RUC: ${institution?.ruc || '1790012345001'} | Tel: ${institution?.telefono || '02-2999-999'}`, headerTextX, 75);

  doc.moveDown(3);

  // Título del reporte
  doc
    .fillColor(darkColor)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('TABLA DE AMORTIZACIÓN Y RESUMEN FINANCIERO', 40, 115, { align: 'center' });

  doc
    .fontSize(9)
    .font('Helvetica-Oblique')
    .fillColor(grayColor)
    .text(`Generado el: ${new Date().toLocaleDateString('es-EC')} - Simulación ID: ${simulation.id}`, 40, 132, { align: 'center' });

  // Resumen de Parámetros de Crédito (Cuadrícula)
  const boxTop = 150;
  doc
    .rect(40, boxTop, 515, 95)
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .stroke();

  doc.font('Helvetica-Bold').fontSize(9).fillColor(darkColor);

  // Columna 1
  doc.text('Producto:', 50, boxTop + 10);
  doc.font('Helvetica').text(simulation.creditType?.nombre || 'Crédito', 130, boxTop + 10);

  doc.font('Helvetica-Bold').text('Monto Solicitado:', 50, boxTop + 25);
  doc.font('Helvetica').text(`$${Number(simulation.monto).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`, 130, boxTop + 25);

  doc.font('Helvetica-Bold').text('Plazo:', 50, boxTop + 40);
  doc.font('Helvetica').text(`${simulation.plazoMeses} meses`, 130, boxTop + 40);

  doc.font('Helvetica-Bold').text('Sistema:', 50, boxTop + 55);
  doc.font('Helvetica').text(simulation.sistemaAmortizacion === 'FRANCES' ? 'Francés (Cuota Fija)' : 'Alemán (Capital Fijo)', 130, boxTop + 55);

  doc.font('Helvetica-Bold').text('Fecha Inicio:', 50, boxTop + 70);
  doc.font('Helvetica').text(simulation.fechaInicio || 'N/A', 130, boxTop + 70);

  // Columna 2
  const col2X = 300;
  doc.font('Helvetica-Bold').text('Tasa Efectiva Anual (TEA):', col2X, boxTop + 10);
  doc.font('Helvetica').text(`${Number(simulation.tasaAnual).toFixed(2)}%`, col2X + 130, boxTop + 10);

  doc.font('Helvetica-Bold').text('Cuota Inicial:', col2X, boxTop + 25);
  doc.font('Helvetica').text(`$${Number(simulation.cuotaInicial).toFixed(2)}`, col2X + 130, boxTop + 25);

  doc.font('Helvetica-Bold').text('Total Intereses:', col2X, boxTop + 40);
  doc.font('Helvetica').text(`$${Number(simulation.totalIntereses).toFixed(2)}`, col2X + 130, boxTop + 40);

  doc.font('Helvetica-Bold').text('Total Cargos / SOLCA:', col2X, boxTop + 55);
  doc.font('Helvetica').text(`$${Number(simulation.totalCargos).toFixed(2)}`, col2X + 130, boxTop + 55);

  doc.font('Helvetica-Bold').fillColor(primaryColor).text('TOTAL A PAGAR:', col2X, boxTop + 70);
  doc.font('Helvetica-Bold').text(`$${Number(simulation.totalPagar).toFixed(2)}`, col2X + 130, boxTop + 70);

  // Tabla de Amortización
  let y = 260;
  const colWidths = [30, 60, 65, 60, 60, 55, 65, 65];
  const colX = [40, 75, 140, 210, 275, 340, 400, 470];

  // Header tabla
  doc.rect(40, y, 515, 20).fill('#f1f5f9');
  doc.font('Helvetica-Bold').fontSize(8).fillColor(darkColor);

  const headers = ['N°', 'Fecha', 'Saldo Inic.', 'Capital', 'Interés', 'Cargos', 'Cuota Total', 'Saldo Final'];
  headers.forEach((h, i) => {
    doc.text(h, colX[i], y + 6);
  });

  y += 22;

  // Filas
  doc.font('Helvetica').fontSize(7.5).fillColor(darkColor);

  rows.forEach((row, idx) => {
    if (y > 750) {
      doc.addPage();
      y = 40;
      // Repetir encabezado en nueva página
      doc.rect(40, y, 515, 18).fill('#f1f5f9');
      doc.font('Helvetica-Bold').fontSize(8).fillColor(darkColor);
      headers.forEach((h, i) => {
        doc.text(h, colX[i], y + 5);
      });
      y += 22;
      doc.font('Helvetica').fontSize(7.5).fillColor(darkColor);
    }

    if (idx % 2 === 1) {
      doc.rect(40, y - 2, 515, 14).fill('#f8fafc');
      doc.fillColor(darkColor);
    }

    doc.text(String(row.numeroCuota), colX[0], y);
    doc.text(String(row.fechaPago), colX[1], y);
    doc.text(`$${Number(row.saldoInicial).toFixed(2)}`, colX[2], y);
    doc.text(`$${Number(row.capital).toFixed(2)}`, colX[3], y);
    doc.text(`$${Number(row.interes).toFixed(2)}`, colX[4], y);
    doc.text(`$${Number(row.cargos).toFixed(2)}`, colX[5], y);
    doc.text(`$${Number(row.totalPago).toFixed(2)}`, colX[6], y);
    doc.text(`$${Number(row.saldoFinal).toFixed(2)}`, colX[7], y);

    y += 15;
  });

  // Nota legal de descargo informativo obligatoria
  if (y > 740) {
    doc.addPage();
    y = 50;
  } else {
    y += 15;
  }

  doc
    .rect(40, y, 515, 45)
    .fill('#fffbeb')
    .stroke('#fef3c7');

  doc
    .fillColor('#92400e')
    .fontSize(8.5)
    .font('Helvetica-Bold')
    .text('NOTA INFORMATIVA / DESCARGO ACADÉMICO:', 50, y + 8);

  doc
    .font('Helvetica')
    .fontSize(8)
    .text(
      'Esta simulación es de carácter informativo y no constituye aprobación ni contrato de crédito. Proyecto universitario para la materia Ingeniería Económica. Tasas reguladas bajo marco del Banco Central del Ecuador a septiembre de 2026.',
      50,
      y + 20,
      { width: 495 }
    );

  doc.end();
}

/**
 * Genera el documento PDF para una simulación de depósito a plazo fijo
 */
function generateInvestmentSimulationPDF({ institution, simulation }, outputStream) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(outputStream);

  const primaryColor = institution?.colorSecundario || '#0369a1';
  const darkColor = '#1e293b';
  const grayColor = '#64748b';

  // Cabecera Institucional
  doc.rect(40, 40, 515, 60).fill(primaryColor);
  const hasLogo = drawInstitutionLogo(doc, institution);
  const headerTextX = hasLogo ? 160 : 55;
  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text(institution?.nombre || 'FinanEcuador Demo', headerTextX, 52);
  doc.fontSize(10).font('Helvetica').text(`Depósito a Plazo Fijo | RUC: ${institution?.ruc || '1790012345001'}`, headerTextX, 75);

  doc.moveDown(3);

  doc.fillColor(darkColor).fontSize(14).font('Helvetica-Bold').text('CERTIFICADO DE SIMULACIÓN DE INVERSIÓN', 40, 120, { align: 'center' });
  doc.fontSize(9).font('Helvetica-Oblique').fillColor(grayColor).text(`Fecha: ${new Date().toLocaleDateString('es-EC')} - Simulación ID: ${simulation.id}`, 40, 138, { align: 'center' });

  const boxTop = 170;
  doc.rect(40, boxTop, 515, 150).strokeColor('#e2e8f0').lineWidth(1).stroke();

  doc.font('Helvetica-Bold').fontSize(10).fillColor(darkColor);

  doc.text('Producto:', 60, boxTop + 20);
  doc.font('Helvetica').text(simulation.product?.nombre || 'Depósito a Plazo Fijo', 220, boxTop + 20);

  doc.font('Helvetica-Bold').text('Monto Invertido (Capital):', 60, boxTop + 40);
  doc.font('Helvetica').text(`$${Number(simulation.monto).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`, 220, boxTop + 40);

  doc.font('Helvetica-Bold').text('Plazo de la Inversión:', 60, boxTop + 60);
  doc.font('Helvetica').text(`${simulation.plazoDias} días`, 220, boxTop + 60);

  doc.font('Helvetica-Bold').text('Tasa de Interés Anual Referencial:', 60, boxTop + 80);
  doc.font('Helvetica').text(`${Number(simulation.tasaAnual).toFixed(2)}% anual`, 220, boxTop + 80);

  doc.font('Helvetica-Bold').text('Interés Estimado a Ganar:', 60, boxTop + 100);
  doc.font('Helvetica').fillColor('#15803d').text(`$${Number(simulation.interesGanado).toFixed(2)}`, 220, boxTop + 100);

  doc.font('Helvetica-Bold').fillColor(primaryColor).text('VALOR FINAL A RECIBIR:', 60, boxTop + 120);
  doc.font('Helvetica-Bold').text(`$${Number(simulation.valorFinal).toFixed(2)}`, 220, boxTop + 120);

  const noteY = 350;
  doc.rect(40, noteY, 515, 55).fill('#f0fdf4').stroke('#bbf7d0');
  doc.fillColor('#166534').fontSize(9).font('Helvetica-Bold').text('CONDICIONES DE LA SIMULACIÓN:', 50, noteY + 10);
  doc.font('Helvetica').fontSize(8).text(
    'Cálculo basado en base 360 días conforme a prácticas del sistema financiero de Ecuador. Esta simulación es de carácter informativo y no constituye contrato ni compromiso vinculante de captación de recursos. Proyecto académico.',
    50,
    noteY + 24,
    { width: 495 }
  );

  doc.end();
}

module.exports = {
  generateCreditSimulationPDF,
  generateInvestmentSimulationPDF,
};
