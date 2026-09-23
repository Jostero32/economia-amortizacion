const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvestmentSimulation = sequelize.define('InvestmentSimulation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
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
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    comment: 'Null para simulaciones anónimas sin login',
  },
  monto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: 'Capital invertido',
  },
  plazoDias: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  tasaAnual: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: false,
    comment: 'Tasa nominal anual aplicada en porcentaje ej: 5.09',
  },
  interesGanado: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: 'Capital * tasaAnual * dias / 360',
  },
  valorFinal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: 'Capital + interesGanado',
  },
  fechaInicio: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  fechaVencimiento: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
}, {
  tableName: 'investment_simulations',
  timestamps: true,
});

module.exports = InvestmentSimulation;
