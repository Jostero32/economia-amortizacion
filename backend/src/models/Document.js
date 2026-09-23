const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  creditApplicationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'credit_applications',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  investmentApplicationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'investment_applications',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  tipo: {
    type: DataTypes.ENUM('CEDULA', 'COMPROBANTE_DOMICILIO', 'COMPROBANTE_INGRESOS', 'SELFIE', 'OTRO'),
    allowNull: false,
  },
  nombreArchivo: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  ruta: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  tamano: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Tamaño del archivo en bytes',
  },
  estado: {
    type: DataTypes.ENUM('PENDIENTE', 'VALIDADO', 'RECHAZADO'),
    defaultValue: 'PENDIENTE',
    comment: 'Validación biométrica simulada para fines académicos',
  },
  comentarioRevision: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  revisadoPor: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  fechaSubida: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'documents',
  timestamps: true,
});

module.exports = Document;
