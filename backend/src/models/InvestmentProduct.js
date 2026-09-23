const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvestmentProduct = sequelize.define('InvestmentProduct', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: 'Depósito a Plazo Fijo',
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  montoMinimo: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 500.00,
  },
  montoMaximo: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 1000000.00,
  },
  plazoMinimoDias: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
  },
  plazoMaximoDias: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1080,
  },
  tasa: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: true,
    comment: 'Tasa referencial base en porcentaje anual',
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
  tableName: 'investment_products',
  timestamps: true,
});

module.exports = InvestmentProduct;
