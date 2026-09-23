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
