const { Sequelize } = require('sequelize');
const config = require('./env');

const sequelize = new Sequelize(config.DB_NAME, config.DB_USER, config.DB_PASSWORD, {
  host: config.DB_HOST,
  port: config.DB_PORT,
  dialect: 'postgres',
  logging: config.NODE_ENV === 'test' ? false : (msg) => {
    // Evitar saturar la consola en desarrollo con queries repetitivas
    if (process.env.DEBUG_SQL === 'true') {
      console.log('[Sequelize SQL]:', msg);
    }
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

module.exports = sequelize;
