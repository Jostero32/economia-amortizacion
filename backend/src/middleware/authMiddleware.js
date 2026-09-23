const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Middleware para autenticar usuarios mediante token JWT almacenado en Cookie HTTP-only
 * o en el header Authorization Bearer como respaldo.
 */
async function authenticateToken(req, res, next) {
  try {
    let token = null;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return errorResponse(res, 'Acceso denegado. No se proporcionó un token de autenticación.', 401);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (jwtError) {
      return errorResponse(res, 'Sesión inválida o expirada. Por favor, inicie sesión nuevamente.', 401);
    }

    const user = await User.findByPk(decoded.id);
    if (!user || !user.activo) {
      return errorResponse(res, 'El usuario asociado al token no existe o ha sido desactivado.', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error en authMiddleware:', error);
    return errorResponse(res, 'Error en la verificación de autenticación.', 500);
  }
}

/**
 * Middleware opcional para capturar usuario si existe sesión sin bloquear visitas anónimas
 */
async function optionalAuth(req, res, next) {
  try {
    let token = null;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = await User.findByPk(decoded.id);
        if (user && user.activo) {
          req.user = user;
        }
      } catch (e) {
        // Ignorar token inválido para rutas públicas
      }
    }
  } catch (e) {
    // Continuar
  }
  next();
}

module.exports = {
  authenticateToken,
  optionalAuth,
};
