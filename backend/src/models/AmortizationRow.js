const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AmortizationRow = sequelize.define('AmortizationRow', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  simulationId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'credit_simulations',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  numeroCuota: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fechaPago: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  saldoInicial: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  cuota: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: 'Cuota pura (capital + interés)',
  },
  capital: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  interes: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  cargos: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: 'Cargos adicionales aplicados en la cuota (ej: desgravamen, SOLCA si aplica)',
  },
  totalPago: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: 'cuota + cargos',
  },
  saldoFinal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
}, {
  tableName: 'amortization_rows',
  timestamps: false,
  indexes: [
    {
      fields: ['simulationId', 'numeroCuota'],
    },
  ],
});

module.exports = AmortizationRow;
