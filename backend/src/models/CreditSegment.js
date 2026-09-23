const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CreditSegment = sequelize.define('CreditSegment', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  codigo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  tasaMaxima: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: false,
    comment: 'Tasa activa efectiva máxima en porcentaje anual, ej: 16.77',
  },
  tasaReferencial: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: false,
    comment: 'Tasa activa referencial en porcentaje anual, ej: 15.74',
  },
  fuente: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: 'Banco Central del Ecuador',
  },
  fechaVigencia: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: '2026-09-01',
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'credit_segments',
  timestamps: true,
});

module.exports = CreditSegment;
