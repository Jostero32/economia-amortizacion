const { DataTypes } = require('sequelize');

const additiveMigrations = [
  {
    tableName: 'investment_applications',
    columns: {
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
    },
  },
  {
    tableName: 'investment_simulations',
    columns: {
      tasaEfectiva: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
      tasaRetencion: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      retencionIR: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      interesNeto: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    },
  },
  {
    tableName: 'charges',
    columns: {
      categoria: {
        type: DataTypes.ENUM('IMPUESTO', 'SEGURO_DESGRAVAMEN', 'SEGURO', 'GASTO_TERCEROS'),
        allowNull: false,
        defaultValue: 'GASTO_TERCEROS',
      },
      anualizarSiPlazoMenorAnio: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
  },
  {
    tableName: 'credit_simulations',
    columns: {
      tasaNominal: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
      cargosDesembolso: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      montoLiquido: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      costoEfectivoAnual: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
    },
  },
  {
    tableName: 'investment_products',
    columns: {
      pagoIntereses: {
        type: DataTypes.ENUM('AL_VENCIMIENTO', 'MENSUAL'),
        allowNull: false,
        defaultValue: 'AL_VENCIMIENTO',
      },
    },
  },
  {
    tableName: 'investment_simulations',
    columns: {
      pagoIntereses: { type: DataTypes.STRING(20), allowNull: true },
      cronogramaPagos: { type: DataTypes.JSON, allowNull: true },
    },
  },
  {
    tableName: 'credit_applications',
    columns: {
      relacionCuotaIngreso: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
      autorizaConsultaBuro: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      fechaAutorizacionBuro: { type: DataTypes.DATE, allowNull: true },
    },
  },
  {
    tableName: 'investment_applications',
    columns: {
      declaraLicitudFondos: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
  },
];

async function runAdditiveMigrations(sequelize) {
  const queryInterface = sequelize.getQueryInterface();

  for (const migration of additiveMigrations) {
    const tableDefinition = await queryInterface.describeTable(migration.tableName);

    for (const [columnName, definition] of Object.entries(migration.columns)) {
      if (!tableDefinition[columnName]) {
        await queryInterface.addColumn(migration.tableName, columnName, definition);
        console.log(`[Migración]: Agregada ${migration.tableName}.${columnName}.`);
      }
    }
  }
}

module.exports = { runAdditiveMigrations };
