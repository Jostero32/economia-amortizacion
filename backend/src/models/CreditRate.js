const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CreditRate = sequelize.define('CreditRate', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  creditTypeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'credit_types',
      key: 'id',
    },
  },
  tasa: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: false,
    comment: 'Tasa efectiva anual en porcentaje, ej: 15.74',
  },
  fechaVigencia: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: '2026-09-01',
  },
  fechaFinVigencia: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Null si está actualmente vigente',
  },
  fuente: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: 'Resolución Directorio Institución / BCE',
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'credit_rates',
  timestamps: true,
});

module.exports = CreditRate;
