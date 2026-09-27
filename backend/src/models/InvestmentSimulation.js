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
  tasaEfectiva: {
    type: DataTypes.DECIMAL(8, 4),
    allowNull: true,
    comment: 'TEA del depósito con pago al vencimiento (BCE, Anexo 1)',
  },
  tasaRetencion: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Porcentaje de retención IR aplicado (0 si el plazo es >= 180 días)',
  },
  retencionIR: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: 'Retención en la fuente del Impuesto a la Renta sobre el interés',
  },
  interesNeto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: 'interesGanado - retencionIR',
  },
  valorFinal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    comment: 'Capital + interesNeto (valor a recibir al vencimiento)',
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
