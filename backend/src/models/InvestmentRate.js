const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvestmentRate = sequelize.define('InvestmentRate', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  investmentProductId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'investment_products',
      key: 'id',
    },
  },
  plazoMinDias: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  plazoMaxDias: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  tasa: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: false,
    comment: 'Tasa nominal referencial anual en porcentaje ej: 4.03',
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
  tableName: 'investment_rates',
  timestamps: true,
});

module.exports = InvestmentRate;
