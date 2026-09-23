const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CreditSimulation = sequelize.define('CreditSimulation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
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
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    comment: 'Null para simulaciones públicas sin login',
  },
  monto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  plazoMeses: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  sistemaAmortizacion: {
    type: DataTypes.ENUM('FRANCES', 'ALEMAN'),
    allowNull: false,
  },
  tasaAnual: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: false,
    comment: 'Tasa efectiva anual aplicada en porcentaje ej: 15.74',
  },
  tasaMensual: {
    type: DataTypes.DECIMAL(8, 6),
    allowNull: false,
    comment: 'Tasa periódica mensual calculada mediante formula (1+i)^(30/360)-1',
  },
  cuotaInicial: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  totalCapital: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  totalIntereses: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  totalCargos: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  totalPagar: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  desgloseCargos: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Detalle de cargos aplicados ej: SOLCA, Desgravamen',
  },
  fechaInicio: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
}, {
  tableName: 'credit_simulations',
  timestamps: true,
});

module.exports = CreditSimulation;
