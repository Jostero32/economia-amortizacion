const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const config = require('../../src/config/env');
const sequelize = require('../../src/config/database');
const {
  User,
  Institution,
  CreditSegment,
  CreditType,
  CreditRate,
  Charge,
  InvestmentProduct,
  InvestmentRate,
  CreditSimulation,
  AmortizationRow,
  InvestmentSimulation,
  CreditApplication,
  InvestmentApplication,
  Document,
  AuditLog,
} = require('../../src/models');
const TEST_USERS = require('../fixtures/users');

/**
 * Garantiza que la base de datos de pruebas exista en PostgreSQL
 */
async function ensureTestDatabaseExists() {
  const testDbName = config.DB_NAME;
  const adminClient = new Client({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: 'postgres', // Conectar a la DB administrativa por defecto
  });

  try {
    await adminClient.connect();
    const checkDbRes = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [testDbName]
    );

    if (checkDbRes.rowCount === 0) {
      // Si no existe, crearla
      await adminClient.query(`CREATE DATABASE "${testDbName}"`);
    }
  } catch (error) {
    // Si ya existe o no se tienen permisos de administración, continuar
    console.warn('[dbSetup] Advertencia al verificar DB de pruebas:', error.message);
  } finally {
    try {
      await adminClient.end();
    } catch (e) {
      // ignorar
    }
  }
}

let isSynced = false;

/**
 * Inicializa el esquema completo de base de datos para la suite de pruebas
 */
async function initTestDatabase() {
  await ensureTestDatabaseExists();
  await sequelize.authenticate();
  if (!isSynced) {
    await sequelize.sync({ force: true });
    isSynced = true;
  }
}

/**
 * Limpia los registros de las tablas entre suites de integración
 */
async function cleanDatabase() {
  const models = [
    AuditLog,
    Document,
    CreditApplication,
    InvestmentApplication,
    AmortizationRow,
    CreditSimulation,
    InvestmentSimulation,
    Charge,
    CreditRate,
    InvestmentRate,
    CreditType,
    InvestmentProduct,
    CreditSegment,
    User,
    Institution,
  ];

  for (const model of models) {
    if (model && typeof model.destroy === 'function') {
      try {
        await model.destroy({ where: {}, truncate: { cascade: true }, restartIdentity: true });
      } catch (e) {
        // Truncate alternativo en caso de dialect differences
        try {
          await model.destroy({ where: {} });
        } catch (err) {
          // ignorar si tabla vacía
        }
      }
    }
  }
}

/**
 * Registra usuarios base para pruebas de integración
 */
async function seedTestUsers() {
  const users = {};
  for (const [key, userData] of Object.entries(TEST_USERS)) {
    const user = await User.create(userData);
    users[key] = user;
  }
  return users;
}

/**
 * Genera un token JWT para un usuario
 */
function generateTestToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre,
    },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const { seedDatabase } = require('../../src/seed/seed');

async function seedCompleteData() {
  await seedDatabase();
}

/**
 * Cierra la conexión de sequelize al finalizar las pruebas
 */
async function closeTestDatabase() {
  // Mantener la conexión abierta para las siguientes suites secuenciales en --runInBand
}

module.exports = {
  sequelize,
  ensureTestDatabaseExists,
  initTestDatabase,
  cleanDatabase,
  seedTestUsers,
  seedCompleteData,
  generateTestToken,
  closeTestDatabase,
};
