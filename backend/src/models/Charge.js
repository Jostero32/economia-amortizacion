const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Charge = sequelize.define('Charge', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  categoria: {
    type: DataTypes.ENUM('IMPUESTO', 'SEGURO_DESGRAVAMEN', 'SEGURO', 'GASTO_TERCEROS', 'DONACION'),
    allowNull: false,
    defaultValue: 'GASTO_TERCEROS',
    comment: 'Impuesto de ley (SOLCA), seguro de desgravamen, otro seguro o gasto a terceros. Las comisiones por conceder el crédito están prohibidas por ley.',
  },
  anualizarSiPlazoMenorAnio: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Si el plazo es menor a un año, el porcentaje se prorratea por días/360 (regla de la contribución SOLCA)',
  },
  tipo: {
    type: DataTypes.ENUM('PORCENTAJE', 'VALOR_FIJO'),
    allowNull: false,
    defaultValue: 'PORCENTAJE',
  },
  valor: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: 'Valor monetario fijo en dólares cuando tipo es VALOR_FIJO',
  },
  porcentaje: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: true,
    defaultValue: 0.0000,
    comment: 'Porcentaje ej: 0.50 para SOLCA (0.50%)',
  },
  baseCalculo: {
    type: DataTypes.ENUM('MONTO_OPERACION', 'SALDO_INSOLUTO', 'CUOTA'),
    allowNull: false,
    defaultValue: 'MONTO_OPERACION',
  },
  aplicacion: {
    type: DataTypes.ENUM('UNA_VEZ', 'POR_CUOTA', 'MENSUAL'),
    allowNull: false,
    defaultValue: 'UNA_VEZ',
  },
  obligatorio: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  creditTypeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'credit_types',
      key: 'id',
    },
    comment: 'Null si aplica a todos los tipos de crédito (ej: SOLCA)',
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'charges',
  timestamps: true,
});

module.exports = Charge;
