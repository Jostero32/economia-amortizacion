const { ageOn } = require('../../utils/dates');
const { compareNames } = require('./nameMatch');

const MIN_AGE = 18;

const lastDigits = (value) => `••${String(value || '').slice(-2)}`;
const formatDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

/**
 * Controles de los datos de la cédula (funciones puras). Cada uno dice qué pasa si no se cumple:
 * los de vigencia y edad rechazan; el resto pasa al asesor.
 * @param {Object} params
 * @param {'ELECTRONICA'|'ANTIGUA'|null} params.tipoCedula
 * @param {Object|null} params.datos - Datos leídos de la MRZ (mrzService.datosFromFields)
 * @param {string|null} params.cedulaRegistrada - Cédula de la cuenta (puede no estar registrada)
 * @param {string} params.nombreRegistrado
 * @param {boolean} params.cedulaEnOtraCuenta - El NUI ya pertenece a otra cuenta
 * @param {string} params.today - AAAA-MM-DD
 */
function dataControls({ tipoCedula, datos, cedulaRegistrada, nombreRegistrado, cedulaEnOtraCuenta, today }) {
  if (tipoCedula === 'ANTIGUA' || !datos) {
    return [{
      codigo: 'MRZ_LEGIBLE',
      ok: false,
      detalle: 'Tu cédula es del modelo anterior (sin la franja de 3 líneas): un asesor verificará sus datos.',
      siFalla: 'REVISION',
    }];
  }

  const controles = [{
    codigo: 'MRZ_LEGIBLE',
    ok: true,
    detalle: `Leímos los datos de tu cédula (terminada en ${lastDigits(datos.nui)}).`,
    siFalla: 'REVISION',
  }];

  const nuiOk = !cedulaRegistrada || cedulaRegistrada === datos.nui;
  controles.push({
    codigo: 'NUI_COINCIDE',
    ok: nuiOk,
    detalle: nuiOk
      ? (cedulaRegistrada ? 'El número de cédula coincide con el de tu cuenta.' : 'Registraremos en tu cuenta el número de cédula leído.')
      : `El número de la cédula (terminado en ${lastDigits(datos.nui)}) no coincide con el de tu cuenta (terminado en ${lastDigits(cedulaRegistrada)}).`,
    siFalla: 'REVISION',
  });

  controles.push({
    codigo: 'CEDULA_UNICA',
    ok: !cedulaEnOtraCuenta,
    detalle: cedulaEnOtraCuenta ? 'Esta cédula ya está registrada en otra cuenta.' : 'La cédula no está registrada en otra cuenta.',
    siFalla: 'REVISION',
  });

  const names = compareNames(nombreRegistrado, datos);
  controles.push({
    codigo: 'NOMBRE_COINCIDE',
    ok: names.coincide,
    detalle: names.coincide
      ? 'Tu nombre coincide con el de la cédula.'
      : `Tu nombre registrado no coincide con el de la cédula${names.faltantes.length ? ` (no encontramos: ${names.faltantes.join(', ')})` : ''}.`,
    siFalla: 'REVISION',
  });

  const edad = datos.fechaNacimiento ? ageOn(datos.fechaNacimiento, today) : null;
  controles.push({
    codigo: 'MAYOR_EDAD',
    ok: edad === null ? null : edad >= MIN_AGE,
    detalle: edad === null
      ? 'No pudimos leer tu fecha de nacimiento.'
      : edad >= MIN_AGE ? 'Eres mayor de edad.' : 'La cédula indica que eres menor de edad: no puedes verificar tu identidad.',
    siFalla: 'RECHAZO',
  });

  const vigente = datos.fechaVencimiento ? datos.fechaVencimiento >= today : null;
  controles.push({
    codigo: 'CEDULA_VIGENTE',
    ok: vigente,
    detalle: vigente === null
      ? 'No pudimos leer la fecha de vencimiento de tu cédula.'
      : vigente
        ? `Tu cédula está vigente hasta el ${formatDate(datos.fechaVencimiento)}.`
        : `Tu cédula venció el ${formatDate(datos.fechaVencimiento)}: renuévala en el Registro Civil y vuelve a intentarlo.`,
    siFalla: 'RECHAZO',
  });

  return controles;
}

module.exports = {
  MIN_AGE,
  dataControls,
};
