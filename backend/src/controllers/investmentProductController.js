const { InvestmentProduct, InvestmentRate } = require('../models');
const { successResponse, errorResponse } = require('../utils/apiResponse');

async function getInvestmentProducts(req, res, next) {
  try {
    const products = await InvestmentProduct.findAll({
      where: { activo: true },
      include: [
        {
          model: InvestmentRate,
          as: 'rates',
          where: { activo: true },
          required: false,
          order: [['plazoMinDias', 'ASC']],
        },
      ],
      order: [['id', 'ASC']],
    });

    return successResponse(res, { products });
  } catch (error) {
    next(error);
  }
}

async function getInvestmentProductById(req, res, next) {
  try {
    const { id } = req.params;
    const product = await InvestmentProduct.findByPk(id, {
      include: [
        {
          model: InvestmentRate,
          as: 'rates',
          where: { activo: true },
          required: false,
          order: [['plazoMinDias', 'ASC']],
        },
      ],
    });

    if (!product || !product.activo) {
      return errorResponse(res, 'Producto de inversión no encontrado o inactivo.', 404);
    }

    return successResponse(res, { product });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getInvestmentProducts,
  getInvestmentProductById,
};
