const app = require('./app');
const config = require('./config/env');
const { sequelize } = require('./models');
const { runAdditiveMigrations } = require('./config/schemaMigrations');
const { seedDatabase } = require('./seed/seed');

async function startServer() {
  try {
    console.log('--- Iniciando Sistema Financiero FinanEcuador Demo ---');
    console.log(`Entorno: ${config.NODE_ENV} | Puerto: ${config.PORT}`);
    console.log(`Conectando a PostgreSQL en ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}...`);

    // 1. Verificar conexión a PostgreSQL
    await sequelize.authenticate();
    console.log('[PostgreSQL]: Conexión exitosa a la base de datos.');

    // 2. Sincronización Model-First con Sequelize
    console.log('[Sequelize]: Sincronizando tablas y migraciones aditivas...');
    await sequelize.sync();
    await runAdditiveMigrations(sequelize);
    console.log('[Sequelize]: Tablas sincronizadas con éxito.');

    // 3. Carga de semilla de datos inicial
    await seedDatabase();

    // 4. Iniciar servidor Express
    app.listen(config.PORT, () => {
      console.log(`====================================================`);
      console.log(` FinanEcuador Demo Backend en línea`);
      console.log(` URL: http://localhost:${config.PORT}`);
      console.log(` API Health: http://localhost:${config.PORT}/api/health`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('[Error crítico al iniciar servidor]:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { startServer };
