/**
 * Fixtures de Usuarios para Pruebas Automatizadas de Autenticación y Autorización
 */

const TEST_USERS = {
  ADMIN: {
    nombre: 'Administrador Pruebas',
    email: 'admin@test.local',
    password: 'Admin123!',
    rol: 'ADMIN',
    cedula: '1710000001',
    telefono: '0990000001',
  },
  ASESOR: {
    nombre: 'Asesor Crédito Pruebas',
    email: 'asesor@test.local',
    password: 'Asesor123!',
    rol: 'ASESOR',
    cedula: '1710000002',
    telefono: '0990000002',
  },
  CLIENTE: {
    nombre: 'Cliente Natural Pruebas',
    email: 'cliente@test.local',
    password: 'Cliente123!',
    rol: 'CLIENTE',
    cedula: '1710000003',
    telefono: '0990000003',
  },
  CLIENTE_DOS: {
    nombre: 'Segundo Cliente Pruebas',
    email: 'cliente2@test.local',
    password: 'Cliente123!',
    rol: 'CLIENTE',
    cedula: '1710000004',
    telefono: '0990000004',
  },
};

module.exports = TEST_USERS;
