const { Op } = require('sequelize');
const { IdentityVerification, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../utils/auditLogger');
const {
  CONSENT_VERSION,
  FACE_DOUBTFUL_DISTANCE,
  FACE_MATCH_DISTANCE,
  MAX_ATTEMPTS,
  MIN_BACK_SHARPNESS,
  YAW_DELTA,
  SMILE_DELTA,
} = require('../config/identity');
const { normalizeImage, cropCard, sharpness } = require('../services/identity/imageService');
const { detectMainFace, compareFaces } = require('../services/identity/faceService');
const { saveImage, readImage, resolveImage } = require('../services/identity/identityStorage');
const { decide, storedState } = require('../services/identity/decisionEngine');
const { identityStatus } = require('../services/identity/identityStatus');
const { readMrz } = require('../services/identity/mrzService');
const { dataControls } = require('../services/identity/dataChecks');
const { generateChallenges, evaluateLiveness } = require('../services/identity/livenessService');
const { todayISO } = require('../utils/dates');

const STATES = ['EN_CURSO', 'EN_REVISION', 'APROBADA', 'RECHAZADA'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Un id mal formado haría fallar la consulta en PostgreSQL: se trata como inexistente
const findById = (id, options) => (UUID_PATTERN.test(String(id)) ? IdentityVerification.findByPk(id, options) : null);
const FILE_FIELDS = { anverso: 'anversoRuta', reverso: 'reversoRuta', selfie: 'selfieRuta' };

// ---------------------------------------------------------------------------------------------
// Vistas: el cliente no recibe rutas de archivos ni datos internos de los controles
// ---------------------------------------------------------------------------------------------
function clientView(verification) {
  if (!verification) return null;
  const v = verification;
  return {
    id: v.id,
    estado: v.estado,
    aprobacionAutomatica: v.aprobacionAutomatica,
    intentos: v.intentos,
    intentosRestantes: Math.max(0, MAX_ATTEMPTS - v.intentos),
    motivos: v.motivos || [],
    controles: (v.controles || []).map(({ codigo, ok, detalle }) => ({ codigo, ok, detalle })),
    rostro: v.rostroResultado ? { resultado: v.rostroResultado, nivel: Number(v.rostroNivel) } : null,
    tipoCedula: v.tipoCedula,
    retos: v.vida?.retos || [],
    umbralesVida: { giro: YAW_DELTA, sonrisa: SMILE_DELTA },
    capturas: { anverso: Boolean(v.anversoRuta), reverso: Boolean(v.reversoRuta), selfie: Boolean(v.selfieRuta) },
    fechaVerificacion: v.fechaVerificacion,
    vigenteHasta: v.vigenteHasta,
    comentarioRevision: v.revisadoPor ? v.comentarioRevision : null,
    // Datos de la cédula verificada: prellenan (y bloquean) los formularios de solicitud
    datos: v.estado === 'APROBADA' && v.datosMrz
      ? {
        cedula: v.datosMrz.nui,
        apellidos: v.datosMrz.apellidos,
        nombres: v.datosMrz.nombres,
        fechaNacimiento: v.datosMrz.fechaNacimiento,
        fechaVencimiento: v.datosMrz.fechaVencimiento,
      }
      : null,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

/** El NUI ya pertenece a otra cuenta (registrado o verificado por otro usuario). */
async function cedulaEnOtraCuenta(nui, userId) {
  if (!nui) return false;
  const [registered, verified] = await Promise.all([
    User.findOne({ where: { cedula: nui, id: { [Op.ne]: userId } }, attributes: ['id'] }),
    IdentityVerification.findOne({
      where: { userId: { [Op.ne]: userId }, estado: 'APROBADA', datosMrz: { nui } },
      attributes: ['id'],
    }),
  ]);
  return Boolean(registered || verified);
}

/** Al aprobar: si la cuenta no tenía cédula, se registra la verificada (si nadie más la tiene). */
async function adoptCedula(verification) {
  const nui = verification.datosMrz?.nui;
  if (!nui) return;
  const user = await User.findByPk(verification.userId, { attributes: ['id', 'cedula'] });
  if (user && !user.cedula && !(await cedulaEnOtraCuenta(nui, user.id))) {
    await User.update({ cedula: nui }, { where: { id: user.id } });
  }
}

function adminView(verification) {
  const v = verification;
  return {
    ...clientView(v),
    controles: v.controles || [],
    rostroDistancia: v.rostroDistancia === null ? null : Number(v.rostroDistancia),
    datosMrz: v.datosMrz,
    vida: v.vida,
    vidaCapturas: (v.vidaRutas || []).length,
    consentimiento: { version: v.consentimientoVersion, fecha: v.consentimientoFecha, ip: v.consentimientoIp },
    fechaRevision: v.fechaRevision,
    comentarioRevision: v.comentarioRevision,
    user: v.user,
    reviewer: v.reviewer,
  };
}

const clientIp = (req) => String(req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
  .replace('::ffff:', '') || null;

/** Verificación propia que todavía admite capturas; responde el error si no. */
async function findOwnInProgress(req, res) {
  const verification = await findById(req.params.id);
  if (!verification || verification.userId !== req.user.id) {
    errorResponse(res, 'Verificación no encontrada.', 404);
    return null;
  }
  if (verification.estado !== 'EN_CURSO') {
    errorResponse(res, 'Esta verificación ya fue enviada y no admite cambios.', 400);
    return null;
  }
  return verification;
}

// ---------------------------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------------------------

/** Estado de la verificación del cliente autenticado. */
async function getMyVerification(req, res, next) {
  try {
    const { verification, verificada, puedeSolicitar } = await identityStatus(req.user.id);
    return successResponse(res, {
      verification: clientView(verification),
      verificada,
      puedeSolicitar,
      consentimientoVersion: CONSENT_VERSION,
    });
  } catch (error) {
    next(error);
  }
}

/** Acepta el consentimiento e inicia la verificación (o reanuda la que está en curso). */
async function startVerification(req, res, next) {
  try {
    const { aceptaConsentimiento, consentimientoVersion } = req.body;
    if (aceptaConsentimiento !== true) {
      return errorResponse(res, 'Debes autorizar el tratamiento de tus datos para verificar tu identidad.', 400);
    }
    if (consentimientoVersion !== CONSENT_VERSION) {
      return errorResponse(res, 'El texto de la autorización cambió. Recarga la página y vuelve a leerlo.', 400);
    }

    const { verification: latest, verificada } = await identityStatus(req.user.id);
    if (verificada) {
      return errorResponse(res, 'Tu identidad ya está verificada.', 409);
    }
    if (latest?.estado === 'EN_REVISION') {
      return errorResponse(res, 'Tu verificación está en revisión. Un asesor la resolverá pronto.', 409);
    }

    const consent = {
      consentimientoVersion,
      consentimientoFecha: new Date(),
      consentimientoIp: clientIp(req),
      vida: { retos: generateChallenges(), generadosEn: new Date() },
      vidaRutas: [],
    };
    const verification = latest?.estado === 'EN_CURSO'
      ? await latest.update(consent)
      : await IdentityVerification.create({ userId: req.user.id, ...consent });

    await logAudit({
      req,
      accion: 'CONSENTIMIENTO_BIOMETRICO',
      entidad: 'IdentityVerification',
      entidadId: verification.id,
      detalles: { version: consentimientoVersion },
    });

    return successResponse(res, { verification: clientView(verification) }, 201, 'Autorización registrada.');
  } catch (error) {
    next(error);
  }
}

/** Anverso: debe verse la foto del titular. */
async function uploadFront(req, res, next) {
  try {
    const verification = await findOwnInProgress(req, res);
    if (!verification) return undefined;
    if (!req.file) return errorResponse(res, 'Adjunta la foto del anverso de tu cédula.', 400);

    const { buffer } = await normalizeImage(req.file.buffer);
    const card = await cropCard(buffer);
    const face = await detectMainFace(card.buffer);
    if (!face) {
      return errorResponse(
        res,
        'No encontramos la foto de tu cédula. Encuadra el anverso completo dentro del marco, con buena luz y sin reflejos.',
        422
      );
    }

    const anversoRuta = await saveImage(verification.id, 'anverso', card.buffer);
    await verification.update({ anversoRuta });
    await logAudit({
      req,
      accion: 'CAPTURA_IDENTIDAD',
      entidad: 'IdentityVerification',
      entidadId: verification.id,
      detalles: { tipo: 'ANVERSO', recortada: card.cropped, confianzaRostro: Math.round(face.score * 100) / 100 },
    });

    return successResponse(res, { verification: clientView(verification) }, 200, 'Recibimos el anverso de tu cédula.');
  } catch (error) {
    next(error);
  }
}

/**
 * Reverso: se leen los datos de la MRZ y se responde de inmediato. Si no se pueden leer, se pide
 * repetir la foto; con una cédula del modelo anterior (sin MRZ) el cliente lo indica y sigue.
 */
async function uploadBack(req, res, next) {
  try {
    const verification = await findOwnInProgress(req, res);
    if (!verification) return undefined;
    if (!req.file) return errorResponse(res, 'Adjunta la foto del reverso de tu cédula.', 400);
    const modeloAnterior = String(req.body.modeloAnterior) === 'true';

    const { buffer } = await normalizeImage(req.file.buffer);
    const card = await cropCard(buffer);
    const nitidez = Math.round(await sharpness(card.buffer));

    let datosMrz = null;
    let mrz = null;
    if (!modeloAnterior) {
      mrz = await readMrz(card.buffer, { expectedNui: req.user.cedula || null });
      if (!mrz.leida) {
        return errorResponse(
          res,
          nitidez < MIN_BACK_SHARPNESS
            ? 'La foto salió borrosa y no pudimos leer las 3 líneas de la parte inferior. Repítela con más luz y la cédula quieta.'
            : 'No pudimos leer las 3 líneas de la parte inferior de tu cédula. Repite la foto; si tu cédula es del modelo anterior (sin esas líneas), indícalo para continuar.',
          422,
          { mrz: 'ILEGIBLE' }
        );
      }
      datosMrz = { ...mrz.datos, consenso: mrz.consenso };
    }

    const reversoRuta = await saveImage(verification.id, 'reverso', card.buffer);
    await verification.update({ reversoRuta, datosMrz, tipoCedula: modeloAnterior ? 'ANTIGUA' : 'ELECTRONICA' });
    await logAudit({
      req,
      accion: 'CAPTURA_IDENTIDAD',
      entidad: 'IdentityVerification',
      entidadId: verification.id,
      detalles: {
        tipo: 'REVERSO',
        recortada: card.cropped,
        nitidez,
        modeloAnterior,
        mrz: mrz ? { consenso: mrz.consenso, intentos: mrz.intentos } : null,
      },
    });

    return successResponse(res, {
      verification: clientView(verification),
      nitidez,
      cedulaLeida: datosMrz ? `••${datosMrz.nui.slice(-2)}` : null,
      advertencia: null,
    }, 200, datosMrz ? 'Leímos los datos de tu cédula.' : 'Recibimos el reverso de tu cédula.');
  } catch (error) {
    next(error);
  }
}

/** Controles del rostro: foto de la cédula, rostro en la selfie y comparación entre ambos. */
function faceControls(cedulaFace, selfieFace) {
  const controles = [
    {
      codigo: 'ROSTRO_CEDULA',
      ok: Boolean(cedulaFace),
      detalle: cedulaFace ? 'Encontramos la foto de tu cédula.' : 'No encontramos la foto en el anverso de tu cédula.',
      siFalla: 'REINTENTO',
    },
    {
      codigo: 'ROSTRO_SELFIE',
      ok: Boolean(selfieFace),
      detalle: selfieFace
        ? 'Tu rostro se ve en la selfie.'
        : 'No encontramos tu rostro en la selfie: mira de frente a la cámara, con buena luz.',
      siFalla: 'REINTENTO',
    },
  ];
  if (!cedulaFace || !selfieFace) return { controles, comparison: null };

  const comparison = compareFaces(cedulaFace.descriptor, selfieFace.descriptor);
  const nivel = `${Math.round(comparison.nivel)} %`;
  const detalle = {
    COINCIDE: `Tu rostro coincide con la foto de la cédula (${nivel}).`,
    DUDOSO: `La coincidencia de tu rostro con la cédula no es concluyente (${nivel}).`,
    NO_COINCIDE: `Tu rostro no coincide con la foto de la cédula (${nivel}).`,
  }[comparison.resultado];
  controles.push({
    codigo: 'ROSTRO_COINCIDE',
    ok: comparison.resultado === 'COINCIDE',
    detalle,
    siFalla: comparison.resultado === 'DUDOSO' ? 'REVISION' : 'REINTENTO',
  });
  return { controles, comparison };
}

/** Selfie: se compara con la cédula, se aplican las reglas y se decide. */
async function uploadSelfie(req, res, next) {
  try {
    const verification = await findOwnInProgress(req, res);
    if (!verification) return undefined;
    if (!verification.anversoRuta || !verification.reversoRuta) {
      return errorResponse(res, 'Primero toma las fotos del anverso y del reverso de tu cédula.', 400);
    }
    const selfieFile = req.files?.selfie?.[0];
    if (!selfieFile) return errorResponse(res, 'Adjunta tu selfie.', 400);

    const { buffer: selfie } = await normalizeImage(selfieFile.buffer);
    const selfieRuta = await saveImage(verification.id, 'selfie', selfie);

    const anverso = await readImage(verification.anversoRuta);
    const cedulaFace = anverso ? await detectMainFace(anverso) : null;
    const selfieFace = await detectMainFace(selfie);
    const { controles: rostro, comparison } = faceControls(cedulaFace, selfieFace);
    const vidaRutas = [];
    const frameFaces = [];
    for (const [index, file] of (req.files.vida || []).entries()) {
      const { buffer } = await normalizeImage(file.buffer);
      vidaRutas.push(await saveImage(verification.id, `vida-${index + 1}`, buffer));
      frameFaces.push(await detectMainFace(buffer));
    }
    const retos = verification.vida?.retos || [];
    const evaluated = vidaRutas.length ? evaluateLiveness({ retos, selfieFace, frameFaces }) : { superada: null, resultados: [] };
    const vida = { retos, generadosEn: verification.vida?.generadosEn, ...evaluated };
    const vidaControl = {
      codigo: 'VIDA',
      ok: vida.superada,
      detalle: !vidaRutas.length
        ? 'No se realizó la prueba de vida: un asesor revisará tu verificación.'
        : vida.superada ? 'Comprobamos los dos movimientos de tu prueba de vida.'
          : vida.resultados.filter((r) => !r.ok).map((r) => r.detalle).join(' '),
      siFalla: vidaRutas.length ? 'REINTENTO' : 'REVISION',
    };
    const datos = verification.datosMrz;
    const controles = [
      ...rostro,
      ...dataControls({
        tipoCedula: verification.tipoCedula,
        datos,
        cedulaRegistrada: req.user.cedula || null,
        nombreRegistrado: req.user.nombre,
        cedulaEnOtraCuenta: await cedulaEnOtraCuenta(datos?.nui, req.user.id),
        today: todayISO(),
      }),
      vidaControl,
    ];

    const intentos = verification.intentos + 1;
    const decision = decide({ controles, intentos, maxIntentos: MAX_ATTEMPTS });
    const aprobada = decision.resultado === 'APROBADA';

    await verification.update({
      selfieRuta,
      vidaRutas,
      vida,
      intentos,
      rostroDistancia: comparison?.distancia ?? null,
      rostroNivel: comparison?.nivel ?? null,
      rostroResultado: comparison?.resultado ?? null,
      controles,
      motivos: decision.motivos,
      estado: storedState(decision.resultado),
      aprobacionAutomatica: decision.aprobacionAutomatica,
      fechaVerificacion: aprobada ? new Date() : null,
      vigenteHasta: aprobada ? datos?.fechaVencimiento || null : null,
    });
    if (aprobada) await adoptCedula(verification);

    await logAudit({
      req,
      accion: 'CAPTURA_IDENTIDAD',
      entidad: 'IdentityVerification',
      entidadId: verification.id,
      detalles: { tipo: 'SELFIE', capturasVida: vidaRutas.length },
    });
    await logAudit({
      req,
      accion: 'VERIFICACION_IDENTIDAD',
      entidad: 'IdentityVerification',
      entidadId: verification.id,
      detalles: {
        resultado: decision.resultado,
        automatica: decision.aprobacionAutomatica,
        intentos,
        distancia: comparison?.distancia ?? null,
      },
    });

    const messages = {
      APROBADA: 'Tu identidad quedó verificada.',
      EN_REVISION: 'Recibimos tu verificación. Un asesor la revisará.',
      REINTENTAR: 'No pudimos verificar tu identidad. Revisa los motivos e inténtalo de nuevo.',
      RECHAZADA: 'No pudimos verificar tu identidad.',
    };
    return successResponse(
      res,
      { verification: clientView(verification), resultado: decision.resultado },
      200,
      messages[decision.resultado]
    );
  } catch (error) {
    next(error);
  }
}

/** Imagen de una verificación: solo el titular, el asesor o el administrador. */
async function getFile(req, res, next) {
  try {
    const verification = await findById(req.params.id);
    if (!verification) return errorResponse(res, 'Verificación no encontrada.', 404);

    const isOwner = verification.userId === req.user.id;
    const isStaff = ['ASESOR', 'ADMIN'].includes(req.user.rol);
    if (!isOwner && !isStaff) return errorResponse(res, 'No tiene permiso para ver esta imagen.', 403);

    const { tipo } = req.params;
    const vida = /^vida-(\d)$/.exec(tipo);
    let ruta = null;
    if (FILE_FIELDS[tipo]) ruta = verification[FILE_FIELDS[tipo]];
    else if (vida) ruta = (verification.vidaRutas || [])[Number(vida[1]) - 1];
    else return errorResponse(res, 'Tipo de imagen no válido.', 400);

    const fullPath = resolveImage(ruta);
    if (!fullPath) return errorResponse(res, 'La imagen no está disponible.', 404);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(fullPath);
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------------------------
// Asesor / Administrador
// ---------------------------------------------------------------------------------------------
const USER_ATTRIBUTES = ['id', 'nombre', 'email', 'cedula', 'telefono'];

/** Cola de verificaciones; las pendientes de revisión, de la más antigua a la más reciente. */
async function listVerifications(req, res, next) {
  try {
    const { estado } = req.query;
    if (estado && !STATES.includes(estado)) {
      return errorResponse(res, `Estado inválido. Opciones: ${STATES.join(', ')}.`, 400);
    }
    const verifications = await IdentityVerification.findAll({
      where: estado ? { estado } : {},
      include: [{ model: User, as: 'user', attributes: USER_ATTRIBUTES }],
      order: estado === 'EN_REVISION' ? [['updatedAt', 'ASC']] : [['updatedAt', 'DESC']],
      limit: 200,
    });
    const counts = await IdentityVerification.count({ group: ['estado'] });
    return successResponse(res, {
      verifications: verifications.map(adminView),
      counts: Object.fromEntries(STATES.map((s) => [s, Number(counts.find((c) => c.estado === s)?.count || 0)])),
    });
  } catch (error) {
    next(error);
  }
}

async function getVerification(req, res, next) {
  try {
    const verification = await findById(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: USER_ATTRIBUTES },
        { model: User, as: 'reviewer', attributes: ['id', 'nombre', 'email'] },
      ],
    });
    if (!verification) return errorResponse(res, 'Verificación no encontrada.', 404);

    // Otras verificaciones del mismo cliente (intentos anteriores rechazados)
    const history = await IdentityVerification.findAll({
      where: { userId: verification.userId, id: { [Op.ne]: verification.id } },
      attributes: ['id', 'estado', 'createdAt', 'comentarioRevision'],
      order: [['createdAt', 'DESC']],
    });
    return successResponse(res, {
      verification: adminView(verification),
      history,
      umbrales: { rostroCoincide: FACE_MATCH_DISTANCE, rostroDudoso: FACE_DOUBTFUL_DISTANCE },
    });
  } catch (error) {
    next(error);
  }
}

/** Decisión del asesor sobre una verificación en revisión. */
async function decideVerification(req, res, next) {
  try {
    const { estado } = req.body;
    const comentario = String(req.body.comentario || '').trim();
    if (!['APROBADA', 'RECHAZADA'].includes(estado)) {
      return errorResponse(res, 'La decisión debe ser APROBADA o RECHAZADA.', 400);
    }
    if (estado === 'RECHAZADA' && comentario.length < 5) {
      return errorResponse(res, 'Explica al cliente por qué no se aprueba su verificación.', 400, {
        comentario: 'El motivo es obligatorio al rechazar.',
      });
    }

    const verification = await findById(req.params.id);
    if (!verification) return errorResponse(res, 'Verificación no encontrada.', 404);
    if (verification.estado !== 'EN_REVISION') {
      return errorResponse(res, 'Solo se pueden resolver verificaciones en revisión.', 400);
    }

    const aprobada = estado === 'APROBADA';
    await verification.update({
      estado,
      aprobacionAutomatica: false,
      revisadoPor: req.user.id,
      fechaRevision: new Date(),
      comentarioRevision: comentario || null,
      fechaVerificacion: aprobada ? new Date() : null,
      vigenteHasta: aprobada ? verification.datosMrz?.fechaVencimiento || null : verification.vigenteHasta,
    });

    if (aprobada) await adoptCedula(verification);

    await logAudit({
      req,
      accion: 'REVISION_IDENTIDAD',
      entidad: 'IdentityVerification',
      entidadId: verification.id,
      detalles: { estado, comentario: comentario || null },
    });

    return successResponse(
      res,
      { verification: adminView(verification) },
      200,
      aprobada ? 'Identidad aprobada.' : 'Verificación rechazada.'
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  clientView,
  getMyVerification,
  startVerification,
  uploadFront,
  uploadBack,
  uploadSelfie,
  getFile,
  listVerifications,
  getVerification,
  decideVerification,
};
