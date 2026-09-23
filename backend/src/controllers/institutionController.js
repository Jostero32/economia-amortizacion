const { Institution } = require('../models');
const { successResponse, errorResponse } = require('../utils/apiResponse');

async function getInstitution(req, res, next) {
  try {
    const institution = await Institution.findOne({ where: { activo: true } });
    if (!institution) {
      return errorResponse(res, 'No se encontró la configuración institucional.', 404);
    }
    return successResponse(res, { institution });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getInstitution,
};
