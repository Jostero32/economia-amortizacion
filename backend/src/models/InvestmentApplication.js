const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InvestmentApplication = sequelize.define('InvestmentApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  codigo: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    comment: 'Código correlativo de solicitud ej: SOL-INV-2026-0001',
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  simulationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'investment_simulations',
      key: 'id',
    },
  },
  investmentProductId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'investment_products',
      key: 'id',
    },
  },
  monto: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  plazoDias: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  tasaAplicada: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: false,
  },
  interesEstimado: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  valorFinalEstimado: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  estado: {
    type: DataTypes.ENUM('PENDIENTE', 'EN_REVISION', 'PENDIENTE_DOCUMENTOS', 'APROBADA', 'RECHAZADA'),
    defaultValue: 'PENDIENTE',
  },
  nombres: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  apellidos: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  cedula: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  telefono: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(120),
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  actividadEconomica: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  ingresosMensuales: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  origenFondos: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Declaración del origen lícito de los recursos a invertir',
  },
  finalidadInversion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  observacionAsesor: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  biometriaValidada: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Validación biométrica simulada para fines académicos',
  },
  asesorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'investment_applications',
  timestamps: true,
});

module.exports = InvestmentApplication;
