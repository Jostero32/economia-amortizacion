-- Script de inicialización de base de datos para PostgreSQL
-- Crea la base de datos de pruebas si no existe
SELECT 'CREATE DATABASE finanecuador_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'finanecuador_test')\gexec
