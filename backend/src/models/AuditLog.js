const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  usuario: {
    type: DataTypes.STRING(150),
    allowNull: true,
    comment: 'Email o identificador del usuario que ejecutó la acción',
  },
  usuarioId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  rol: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  accion: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'LOGIN, CREAR_CREDITO, EDITAR_CREDITO, CAMBIAR_TASA, CREAR_COBRO, CREAR_INVERSION, CREAR_SOLICITUD, CAMBIAR_ESTADO, SUBIR_DOCUMENTO, VALIDAR_DOCUMENTO',
  },
  entidad: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  entidadId: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  detalles: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'audit_logs',
  timestamps: false,
});

module.exports = AuditLog;
