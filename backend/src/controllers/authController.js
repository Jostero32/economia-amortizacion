const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { User } = require('../models');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../utils/auditLogger');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre,
    },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  });
}

async function register(req, res, next) {
  try {
    const { nombre, email, password, cedula, telefono } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return errorResponse(res, 'El correo electrónico ya se encuentra registrado.', 409);
    }

    if (cedula) {
      const existingCedula = await User.findOne({ where: { cedula } });
      if (existingCedula) {
        return errorResponse(res, 'La cédula ya se encuentra registrada en el sistema.', 409);
      }
    }

    const newUser = await User.create({
      nombre,
      email,
      password,
      rol: 'CLIENTE',
      cedula: cedula || null,
      telefono: telefono || null,
      activo: true,
    });

    const token = generateToken(newUser);
    setTokenCookie(res, token);

    await logAudit({
      req,
      accion: 'LOGIN',
      entidad: 'User',
      entidadId: newUser.id,
      usuario: newUser.email,
      usuarioId: newUser.id,
      rol: newUser.rol,
      detalles: { evento: 'Registro inicial de cliente' },
    });

    return successResponse(
      res,
      {
        user: newUser,
        token,
      },
      201,
      'Registro exitoso.'
    );
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !user.activo) {
      return errorResponse(res, 'Credenciales inválidas o cuenta inactiva.', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Credenciales inválidas o cuenta inactiva.', 401);
    }

    const token = generateToken(user);
    setTokenCookie(res, token);

    await logAudit({
      req,
      accion: 'LOGIN',
      entidad: 'User',
      entidadId: user.id,
      usuario: user.email,
      usuarioId: user.id,
      rol: user.rol,
      detalles: { evento: 'Inicio de sesión exitoso' },
    });

    return successResponse(
      res,
      {
        user,
        token,
      },
      200,
      'Inicio de sesión exitoso.'
    );
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  res.clearCookie('token');
  return successResponse(res, null, 200, 'Sesión cerrada exitosamente.');
}

async function getMe(req, res) {
  return successResponse(res, { user: req.user });
}

module.exports = {
  register,
  login,
  logout,
  getMe,
};
