const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Institution = sequelize.define('Institution', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  tipo: {
    type: DataTypes.ENUM('BANCO_PRIVADO', 'COOPERATIVA'),
    allowNull: false,
    defaultValue: 'BANCO_PRIVADO',
  },
  ruc: {
    type: DataTypes.STRING(13),
    allowNull: false,
  },
  logo: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: '/LogoFinanEcuador.png',
  },
  direccion: {
    type: DataTypes.STRING(255),
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
  sitioWeb: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  colorPrincipal: {
    type: DataTypes.STRING(20),
    defaultValue: '#0f766e',
  },
  colorSecundario: {
    type: DataTypes.STRING(20),
    defaultValue: '#0369a1',
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'institutions',
  timestamps: true,
});

module.exports = Institution;
