const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CreditApplication = sequelize.define('CreditApplication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  codigo: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    comment: 'Código correlativo de solicitud ej: SOL-CRE-2026-0001',
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
      model: 'credit_simulations',
      key: 'id',
    },
  },
  creditTypeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'credit_types',
      key: 'id',
    },
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
  tasaAplicada: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: false,
  },
  cuotaEstimada: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  estado: {
    type: DataTypes.ENUM('PENDIENTE', 'EN_REVISION', 'PENDIENTE_DOCUMENTOS', 'APROBADA', 'RECHAZADA'),
    defaultValue: 'PENDIENTE',
  },
  // Datos socioeconómicos del solicitante según sección 30
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
  fechaNacimiento: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  estadoCivil: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  direccion: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  ciudad: {
    type: DataTypes.STRING(100),
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
    allowNull: false,
  },
  egresosMensuales: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
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
  tableName: 'credit_applications',
  timestamps: true,
});

module.exports = CreditApplication;
