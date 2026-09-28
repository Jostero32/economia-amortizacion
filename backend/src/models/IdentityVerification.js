const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Verificación de identidad (eKYC) de un cliente: consentimiento, capturas de la cédula y la selfie,
 * resultados de cada control y la decisión (automática o del asesor). Se hace una vez por persona.
 */
const IdentityVerification = sequelize.define('IdentityVerification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  estado: {
    type: DataTypes.ENUM('EN_CURSO', 'EN_REVISION', 'APROBADA', 'RECHAZADA'),
    allowNull: false,
    defaultValue: 'EN_CURSO',
  },
  aprobacionAutomatica: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  intentos: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Evaluaciones realizadas; al agotarse pasa al asesor',
  },
  consentimientoVersion: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  consentimientoFecha: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  consentimientoIp: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  anversoRuta: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  reversoRuta: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  selfieRuta: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  vidaRutas: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Fotogramas de los retos de la prueba de vida',
  },
  tipoCedula: {
    type: DataTypes.ENUM('ELECTRONICA', 'ANTIGUA'),
    allowNull: true,
    comment: 'ELECTRONICA si el reverso tiene MRZ legible; ANTIGUA si el cliente indica el modelo anterior',
  },
  rostroDistancia: {
    type: DataTypes.DECIMAL(6, 4),
    allowNull: true,
    comment: 'Distancia euclidiana entre los descriptores de la cédula y la selfie',
  },
  rostroNivel: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Nivel de coincidencia (%) derivado de la distancia',
  },
  rostroResultado: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'COINCIDE, DUDOSO o NO_COINCIDE',
  },
  datosMrz: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Datos leídos de la MRZ: NUI, documento, nombres, fechas y sexo',
  },
  vida: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Retos pedidos y resultado de la prueba de vida',
  },
  controles: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Cada control evaluado: { codigo, ok, detalle }',
  },
  motivos: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Motivos de la decisión que se muestran al cliente y al asesor',
  },
  fechaVerificacion: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  vigenteHasta: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Vencimiento de la cédula verificada',
  },
  revisadoPor: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  fechaRevision: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  comentarioRevision: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'identity_verifications',
  timestamps: true,
});

module.exports = IdentityVerification;
