const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CreditType = sequelize.define('CreditType', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  segmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'credit_segments',
      key: 'id',
    },
  },
  tasaInstitucion: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: false,
    comment: 'Tasa activa efectiva anual propia fijada por la institución en porcentaje, ej: 15.74',
  },
  montoMinimo: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 500.00,
  },
  montoMaximo: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 50000.00,
  },
  plazoMinimo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    comment: 'Plazo mínimo en meses',
  },
  plazoMaximo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 72,
    comment: 'Plazo máximo en meses',
  },
  icono: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'credit_card',
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'credit_types',
  timestamps: true,
});

module.exports = CreditType;
