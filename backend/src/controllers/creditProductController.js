const { CreditType, CreditSegment, CreditRate, Charge } = require('../models');
const { successResponse, errorResponse } = require('../utils/apiResponse');

async function getCreditProducts(req, res, next) {
  try {
    const products = await CreditType.findAll({
      where: { activo: true },
      include: [
        {
          model: CreditSegment,
          as: 'segment',
          attributes: ['id', 'codigo', 'nombre', 'tasaMaxima', 'tasaReferencial', 'fuente', 'fechaVigencia'],
        },
        {
          model: Charge,
          as: 'charges',
          where: { activo: true },
          required: false,
        },
      ],
      order: [['id', 'ASC']],
    });

    // Cargar también cobros generales (donde creditTypeId es null, como SOLCA)
    const generalCharges = await Charge.findAll({
      where: {
        activo: true,
        creditTypeId: null,
      },
    });

    return successResponse(res, {
      products,
      generalCharges,
    });
  } catch (error) {
    next(error);
  }
}

async function getCreditProductById(req, res, next) {
  try {
    const { id } = req.params;
    const product = await CreditType.findByPk(id, {
      include: [
        {
          model: CreditSegment,
          as: 'segment',
        },
        {
          model: CreditRate,
          as: 'rates',
          where: { activo: true },
          required: false,
          order: [['fechaVigencia', 'DESC']],
        },
        {
          model: Charge,
          as: 'charges',
          where: { activo: true },
          required: false,
        },
      ],
    });

    if (!product || !product.activo) {
      return errorResponse(res, 'Producto de crédito no encontrado o inactivo.', 404);
    }

    const generalCharges = await Charge.findAll({
      where: {
        activo: true,
        creditTypeId: null,
      },
    });

    return successResponse(res, {
      product,
      generalCharges,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCreditProducts,
  getCreditProductById,
};
