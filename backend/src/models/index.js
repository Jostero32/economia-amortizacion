const sequelize = require('../config/database');
const models = require('./associations');

// Inicializar asociaciones
models.setupAssociations();

module.exports = {
  sequelize,
  ...models,
};
