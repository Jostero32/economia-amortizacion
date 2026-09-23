const Institution = require('./Institution');
const User = require('./User');
const CreditSegment = require('./CreditSegment');
const CreditType = require('./CreditType');
const CreditRate = require('./CreditRate');
const Charge = require('./Charge');
const CreditSimulation = require('./CreditSimulation');
const AmortizationRow = require('./AmortizationRow');
const InvestmentProduct = require('./InvestmentProduct');
const InvestmentRate = require('./InvestmentRate');
const InvestmentSimulation = require('./InvestmentSimulation');
const CreditApplication = require('./CreditApplication');
const InvestmentApplication = require('./InvestmentApplication');
const Document = require('./Document');
const AuditLog = require('./AuditLog');

function setupAssociations() {
  // Segmentos y Productos de Crédito
  CreditSegment.hasMany(CreditType, { foreignKey: 'segmentId', as: 'creditTypes' });
  CreditType.belongsTo(CreditSegment, { foreignKey: 'segmentId', as: 'segment' });

  // Historial de Tasas de Crédito
  CreditType.hasMany(CreditRate, { foreignKey: 'creditTypeId', as: 'rates' });
  CreditRate.belongsTo(CreditType, { foreignKey: 'creditTypeId', as: 'creditType' });

  // Cobros por tipo de crédito (opcional o general si null)
  CreditType.hasMany(Charge, { foreignKey: 'creditTypeId', as: 'charges' });
  Charge.belongsTo(CreditType, { foreignKey: 'creditTypeId', as: 'creditType' });

  // Simulaciones de Crédito
  CreditType.hasMany(CreditSimulation, { foreignKey: 'creditTypeId', as: 'simulations' });
  CreditSimulation.belongsTo(CreditType, { foreignKey: 'creditTypeId', as: 'creditType' });

  User.hasMany(CreditSimulation, { foreignKey: 'userId', as: 'creditSimulations' });
  CreditSimulation.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  CreditSimulation.hasMany(AmortizationRow, { foreignKey: 'simulationId', as: 'rows', onDelete: 'CASCADE' });
  AmortizationRow.belongsTo(CreditSimulation, { foreignKey: 'simulationId', as: 'simulation' });

  // Inversiones y Tasas
  InvestmentProduct.hasMany(InvestmentRate, { foreignKey: 'investmentProductId', as: 'rates' });
  InvestmentRate.belongsTo(InvestmentProduct, { foreignKey: 'investmentProductId', as: 'product' });

  InvestmentProduct.hasMany(InvestmentSimulation, { foreignKey: 'investmentProductId', as: 'simulations' });
  InvestmentSimulation.belongsTo(InvestmentProduct, { foreignKey: 'investmentProductId', as: 'product' });

  User.hasMany(InvestmentSimulation, { foreignKey: 'userId', as: 'investmentSimulations' });
  InvestmentSimulation.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // Solicitudes de Crédito
  User.hasMany(CreditApplication, { foreignKey: 'userId', as: 'creditApplications' });
  CreditApplication.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  User.hasMany(CreditApplication, { foreignKey: 'asesorId', as: 'asesorCreditApplications' });
  CreditApplication.belongsTo(User, { foreignKey: 'asesorId', as: 'asesor' });

  CreditType.hasMany(CreditApplication, { foreignKey: 'creditTypeId', as: 'applications' });
  CreditApplication.belongsTo(CreditType, { foreignKey: 'creditTypeId', as: 'creditType' });

  CreditSimulation.hasOne(CreditApplication, { foreignKey: 'simulationId', as: 'application' });
  CreditApplication.belongsTo(CreditSimulation, { foreignKey: 'simulationId', as: 'simulation' });

  // Solicitudes de Inversión
  User.hasMany(InvestmentApplication, { foreignKey: 'userId', as: 'investmentApplications' });
  InvestmentApplication.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  User.hasMany(InvestmentApplication, { foreignKey: 'asesorId', as: 'asesorInvestmentApplications' });
  InvestmentApplication.belongsTo(User, { foreignKey: 'asesorId', as: 'asesor' });

  InvestmentProduct.hasMany(InvestmentApplication, { foreignKey: 'investmentProductId', as: 'applications' });
  InvestmentApplication.belongsTo(InvestmentProduct, { foreignKey: 'investmentProductId', as: 'product' });

  InvestmentSimulation.hasOne(InvestmentApplication, { foreignKey: 'simulationId', as: 'application' });
  InvestmentApplication.belongsTo(InvestmentSimulation, { foreignKey: 'simulationId', as: 'simulation' });

  // Documentos
  CreditApplication.hasMany(Document, { foreignKey: 'creditApplicationId', as: 'documents', onDelete: 'CASCADE' });
  Document.belongsTo(CreditApplication, { foreignKey: 'creditApplicationId', as: 'creditApplication' });

  InvestmentApplication.hasMany(Document, { foreignKey: 'investmentApplicationId', as: 'documents', onDelete: 'CASCADE' });
  Document.belongsTo(InvestmentApplication, { foreignKey: 'investmentApplicationId', as: 'investmentApplication' });

  User.hasMany(Document, { foreignKey: 'revisadoPor', as: 'reviewedDocuments' });
  Document.belongsTo(User, { foreignKey: 'revisadoPor', as: 'reviewer' });
}

module.exports = {
  setupAssociations,
  Institution,
  User,
  CreditSegment,
  CreditType,
  CreditRate,
  Charge,
  CreditSimulation,
  AmortizationRow,
  InvestmentProduct,
  InvestmentRate,
  InvestmentSimulation,
  CreditApplication,
  InvestmentApplication,
  Document,
  AuditLog,
};
