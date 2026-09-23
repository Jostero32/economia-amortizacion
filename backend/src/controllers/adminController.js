const {
  Institution,
  CreditType,
  CreditSegment,
  CreditRate,
  Charge,
  InvestmentProduct,
  InvestmentRate,
  User,
  AuditLog,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../utils/auditLogger');

// 1. Institución
async function updateInstitution(req, res, next) {
  try {
    const allowedFields = [
      'nombre',
      'tipo',
      'ruc',
      'direccion',
      'telefono',
      'email',
      'sitioWeb',
      'logo',
      'colorPrincipal',
      'colorSecundario',
    ];
    const institutionData = Object.fromEntries(
      allowedFields
        .filter((field) => req.body[field] !== undefined)
        .map((field) => [field, req.body[field]])
    );

    let institution = await Institution.findOne({ where: { activo: true } });
    if (!institution) {
      institution = await Institution.create(institutionData);
    } else {
      await institution.update(institutionData);
    }

    await logAudit({
      req,
      accion: 'EDITAR_INSTITUCION',
      entidad: 'Institution',
      entidadId: institution.id,
      detalles: institutionData,
    });

    return successResponse(res, { institution }, 200, 'Datos de la institución actualizados.');
  } catch (error) {
    next(error);
  }
}

async function uploadInstitutionLogo(req, res, next) {
  try {
    if (!req.file) {
      return errorResponse(res, 'Debe seleccionar una imagen para el logotipo.', 400);
    }

    const institution = await Institution.findOne({ where: { activo: true } });
    if (!institution) {
      return errorResponse(res, 'No se encontró la configuración institucional.', 404);
    }

    const logo = `/uploads/${req.file.filename}`;
    await institution.update({ logo });

    await logAudit({
      req,
      accion: 'EDITAR_INSTITUCION',
      entidad: 'Institution',
      entidadId: institution.id,
      detalles: { campo: 'logo', logo },
    });

    return successResponse(res, { institution, logo }, 200, 'Logotipo institucional actualizado.');
  } catch (error) {
    next(error);
  }
}

// 2. Productos de Crédito
async function createCreditProduct(req, res, next) {
  try {
    const {
      nombre,
      descripcion,
      segmentId,
      tasaInstitucion,
      montoMinimo,
      montoMaximo,
      plazoMinimo,
      plazoMaximo,
      icono,
    } = req.body;

    const segment = await CreditSegment.findByPk(segmentId);
    if (!segment) {
      return errorResponse(res, 'Segmento de crédito regulatorio no encontrado.', 404);
    }

    // Validación obligatoria de tasa
    if (Number(tasaInstitucion) > Number(segment.tasaMaxima)) {
      return errorResponse(
        res,
        'La tasa configurada supera la tasa activa efectiva máxima registrada para este segmento.',
        400
      );
    }

    const product = await CreditType.create({
      nombre,
      descripcion,
      segmentId,
      tasaInstitucion: Number(tasaInstitucion),
      montoMinimo: montoMinimo || 500,
      montoMaximo: montoMaximo || 50000,
      plazoMinimo: plazoMinimo || 3,
      plazoMaximo: plazoMaximo || 72,
      icono: icono || 'credit_card',
      activo: true,
    });

    // Registrar en histórico de tasas
    await CreditRate.create({
      creditTypeId: product.id,
      tasa: Number(tasaInstitucion),
      fechaVigencia: new Date().toISOString().split('T')[0],
      fuente: 'Configuración Administrativa',
      activo: true,
    });

    await logAudit({
      req,
      accion: 'CREAR_CREDITO',
      entidad: 'CreditType',
      entidadId: product.id,
      detalles: { nombre, tasaInstitucion, segmentId },
    });

    return successResponse(res, { product }, 201, 'Producto de crédito creado con éxito.');
  } catch (error) {
    next(error);
  }
}

async function updateCreditProduct(req, res, next) {
  try {
    const { id } = req.params;
    const product = await CreditType.findByPk(id, {
      include: [{ model: CreditSegment, as: 'segment' }],
    });

    if (!product) {
      return errorResponse(res, 'Producto de crédito no encontrado.', 404);
    }

    const {
      nombre,
      descripcion,
      segmentId,
      tasaInstitucion,
      montoMinimo,
      montoMaximo,
      plazoMinimo,
      plazoMaximo,
      activo,
      icono,
    } = req.body;

    let segment = product.segment;
    if (segmentId && segmentId !== product.segmentId) {
      segment = await CreditSegment.findByPk(segmentId);
      if (!segment) {
        return errorResponse(res, 'Segmento de crédito regulatorio no encontrado.', 404);
      }
    }

    // Si se modifica la tasa, validar contra la tasa máxima vigente del segmento
    const newRate = tasaInstitucion !== undefined ? Number(tasaInstitucion) : Number(product.tasaInstitucion);
    if (newRate > Number(segment.tasaMaxima)) {
      return errorResponse(
        res,
        'La tasa configurada supera la tasa activa efectiva máxima registrada para este segmento.',
        400
      );
    }

    // Si cambió la tasa, cerrar vigencia de la anterior y crear nuevo registro histórico
    if (tasaInstitucion !== undefined && Number(tasaInstitucion) !== Number(product.tasaInstitucion)) {
      const todayStr = new Date().toISOString().split('T')[0];

      // Finalizar tasa anterior
      await CreditRate.update(
        { fechaFinVigencia: todayStr, activo: false },
        { where: { creditTypeId: product.id, fechaFinVigencia: null } }
      );

      // Crear nuevo registro de tasa histórica
      await CreditRate.create({
        creditTypeId: product.id,
        tasa: newRate,
        fechaVigencia: todayStr,
        fuente: 'Resolución Administrativa',
        activo: true,
      });

      await logAudit({
        req,
        accion: 'CAMBIAR_TASA',
        entidad: 'CreditRate',
        entidadId: product.id,
        detalles: {
          tasaAnterior: product.tasaInstitucion,
          nuevaTasa: newRate,
          tasaMaximaSegmento: segment.tasaMaxima,
        },
      });
    }

    await product.update({
      nombre: nombre !== undefined ? nombre : product.nombre,
      descripcion: descripcion !== undefined ? descripcion : product.descripcion,
      segmentId: segmentId !== undefined ? segmentId : product.segmentId,
      tasaInstitucion: newRate,
      montoMinimo: montoMinimo !== undefined ? montoMinimo : product.montoMinimo,
      montoMaximo: montoMaximo !== undefined ? montoMaximo : product.montoMaximo,
      plazoMinimo: plazoMinimo !== undefined ? plazoMinimo : product.plazoMinimo,
      plazoMaximo: plazoMaximo !== undefined ? plazoMaximo : product.plazoMaximo,
      activo: activo !== undefined ? activo : product.activo,
      icono: icono !== undefined ? icono : product.icono,
    });

    await logAudit({
      req,
      accion: 'EDITAR_CREDITO',
      entidad: 'CreditType',
      entidadId: product.id,
      detalles: req.body,
    });

    return successResponse(res, { product }, 200, 'Producto de crédito actualizado correctamente.');
  } catch (error) {
    next(error);
  }
}

async function deleteCreditProduct(req, res, next) {
  try {
    const { id } = req.params;
    const product = await CreditType.findByPk(id);
    if (!product) {
      return errorResponse(res, 'Producto no encontrado.', 404);
    }
    // Desactivación lógica
    product.activo = false;
    await product.save();

    await logAudit({
      req,
      accion: 'EDITAR_CREDITO',
      entidad: 'CreditType',
      entidadId: product.id,
      detalles: { accion: 'Desactivación lógica del producto' },
    });

    return successResponse(res, null, 200, 'Producto desactivado exitosamente.');
  } catch (error) {
    next(error);
  }
}

// 3. Cobros Adicionales (Charges)
async function createCharge(req, res, next) {
  try {
    const { nombre, tipo, valor, porcentaje, baseCalculo, aplicacion, obligatorio, creditTypeId, descripcion } = req.body;

    const charge = await Charge.create({
      nombre,
      tipo: tipo || 'PORCENTAJE',
      valor: valor || 0,
      porcentaje: porcentaje || 0,
      baseCalculo: baseCalculo || 'MONTO_OPERACION',
      aplicacion: aplicacion || 'UNA_VEZ',
      obligatorio: obligatorio !== undefined ? obligatorio : false,
      creditTypeId: creditTypeId || null,
      descripcion: descripcion || null,
      activo: true,
    });

    await logAudit({
      req,
      accion: 'CREAR_COBRO',
      entidad: 'Charge',
      entidadId: charge.id,
      detalles: req.body,
    });

    return successResponse(res, { charge }, 201, 'Cobro adicional registrado con éxito.');
  } catch (error) {
    next(error);
  }
}

async function updateCharge(req, res, next) {
  try {
    const { id } = req.params;
    const charge = await Charge.findByPk(id);
    if (!charge) return errorResponse(res, 'Cobro adicional no encontrado.', 404);

    await charge.update(req.body);

    await logAudit({
      req,
      accion: 'EDITAR_COBRO',
      entidad: 'Charge',
      entidadId: charge.id,
      detalles: req.body,
    });

    return successResponse(res, { charge }, 200, 'Cobro adicional actualizado correctamente.');
  } catch (error) {
    next(error);
  }
}

async function deleteCharge(req, res, next) {
  try {
    const { id } = req.params;
    const charge = await Charge.findByPk(id);
    if (!charge) return errorResponse(res, 'Cobro adicional no encontrado.', 404);

    charge.activo = false;
    await charge.save();

    return successResponse(res, null, 200, 'Cobro desactivado correctamente.');
  } catch (error) {
    next(error);
  }
}

// 4. Inversiones
async function createInvestmentProduct(req, res, next) {
  try {
    const { nombre, descripcion, montoMinimo, montoMaximo, plazoMinimoDias, plazoMaximoDias, tasa, fuente } = req.body;

    const product = await InvestmentProduct.create({
      nombre,
      descripcion,
      montoMinimo: montoMinimo || 500,
      montoMaximo: montoMaximo || 500000,
      plazoMinimoDias: plazoMinimoDias || 30,
      plazoMaximoDias: plazoMaximoDias || 1080,
      tasa: tasa || 5.09,
      fuente: fuente || 'Banco Central del Ecuador',
      fechaVigencia: new Date().toISOString().split('T')[0],
      activo: true,
    });

    await logAudit({
      req,
      accion: 'CREAR_INVERSION',
      entidad: 'InvestmentProduct',
      entidadId: product.id,
      detalles: req.body,
    });

    return successResponse(res, { product }, 201, 'Producto de inversión creado con éxito.');
  } catch (error) {
    next(error);
  }
}

async function updateInvestmentProduct(req, res, next) {
  try {
    const { id } = req.params;
    const product = await InvestmentProduct.findByPk(id);
    if (!product) return errorResponse(res, 'Producto de inversión no encontrado.', 404);

    await product.update(req.body);

    return successResponse(res, { product }, 200, 'Producto de inversión actualizado.');
  } catch (error) {
    next(error);
  }
}

async function deleteInvestmentProduct(req, res, next) {
  try {
    const { id } = req.params;
    const product = await InvestmentProduct.findByPk(id);
    if (!product) return errorResponse(res, 'Producto de inversión no encontrado.', 404);

    product.activo = false;
    await product.save();

    return successResponse(res, null, 200, 'Producto de inversión desactivado.');
  } catch (error) {
    next(error);
  }
}

// 5. Gestión de Tasas Históricas
async function createRate(req, res, next) {
  try {
    const { creditTypeId, tasa, fechaVigencia, fuente } = req.body;
    const product = await CreditType.findByPk(creditTypeId, {
      include: [{ model: CreditSegment, as: 'segment' }],
    });

    if (!product) return errorResponse(res, 'Producto de crédito no encontrado.', 404);

    if (Number(tasa) > Number(product.segment.tasaMaxima)) {
      return errorResponse(
        res,
        'La tasa configurada supera la tasa activa efectiva máxima registrada para este segmento.',
        400
      );
    }

    const todayStr = fechaVigencia || new Date().toISOString().split('T')[0];

    // Cerrar vigencia anterior
    await CreditRate.update(
      { fechaFinVigencia: todayStr, activo: false },
      { where: { creditTypeId, fechaFinVigencia: null } }
    );

    const rate = await CreditRate.create({
      creditTypeId,
      tasa: Number(tasa),
      fechaVigencia: todayStr,
      fuente: fuente || 'Resolución Directorio',
      activo: true,
    });

    // Actualizar producto
    product.tasaInstitucion = Number(tasa);
    await product.save();

    await logAudit({
      req,
      accion: 'CAMBIAR_TASA',
      entidad: 'CreditRate',
      entidadId: rate.id,
      detalles: { creditTypeId, tasa },
    });

    return successResponse(res, { rate }, 201, 'Tasa registrada exitosamente.');
  } catch (error) {
    next(error);
  }
}

async function updateRate(req, res, next) {
  try {
    const { id } = req.params;
    const rate = await CreditRate.findByPk(id);
    if (!rate) return errorResponse(res, 'Registro de tasa no encontrado.', 404);

    await rate.update(req.body);
    return successResponse(res, { rate }, 200, 'Tasa actualizada.');
  } catch (error) {
    next(error);
  }
}

// 6. Auditoría y Usuarios
async function getAuditLogs(req, res, next) {
  try {
    const logs = await AuditLog.findAll({
      limit: 100,
      order: [['fecha', 'DESC']],
    });
    return successResponse(res, { logs });
  } catch (error) {
    next(error);
  }
}

async function getUsers(req, res, next) {
  try {
    const users = await User.findAll({
      attributes: ['id', 'nombre', 'email', 'rol', 'cedula', 'telefono', 'activo', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });
    return successResponse(res, { users });
  } catch (error) {
    next(error);
  }
}

async function updateUserAccess(req, res, next) {
  try {
    const { id } = req.params;
    const { rol, activo } = req.body;
    const user = await User.findByPk(id);

    if (!user) {
      return errorResponse(res, 'Usuario no encontrado.', 404);
    }

    const nextRole = rol !== undefined ? rol : user.rol;
    const nextActive = activo !== undefined ? activo : user.activo;

    if (user.id === req.user.id && (nextRole !== 'ADMIN' || !nextActive)) {
      return errorResponse(
        res,
        'No puede quitarse el rol de administrador ni desactivar su propia cuenta.',
        400
      );
    }

    const removesActiveAdmin = user.rol === 'ADMIN'
      && user.activo
      && (nextRole !== 'ADMIN' || !nextActive);

    if (removesActiveAdmin) {
      const activeAdminCount = await User.count({ where: { rol: 'ADMIN', activo: true } });
      if (activeAdminCount <= 1) {
        return errorResponse(res, 'Debe permanecer al menos un administrador activo.', 400);
      }
    }

    const previousAccess = { rol: user.rol, activo: user.activo };
    await user.update({ rol: nextRole, activo: nextActive });

    await logAudit({
      req,
      accion: 'EDITAR_USUARIO',
      entidad: 'User',
      entidadId: user.id,
      detalles: {
        usuario: user.email,
        anterior: previousAccess,
        nuevo: { rol: user.rol, activo: user.activo },
      },
    });

    return successResponse(res, { user }, 200, 'Acceso del usuario actualizado.');
  } catch (error) {
    next(error);
  }
}

async function getCreditSegments(req, res, next) {
  try {
    const segments = await CreditSegment.findAll({
      where: { activo: true },
      order: [['id', 'ASC']],
    });
    return successResponse(res, { segments });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  updateInstitution,
  uploadInstitutionLogo,
  createCreditProduct,
  updateCreditProduct,
  deleteCreditProduct,
  createCharge,
  updateCharge,
  deleteCharge,
  createInvestmentProduct,
  updateInvestmentProduct,
  deleteInvestmentProduct,
  createRate,
  updateRate,
  getAuditLogs,
  getUsers,
  updateUserAccess,
  getCreditSegments,
};
