const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

const config = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const publicRoutes = require('./routes/publicRoutes');
const clientRoutes = require('./routes/clientRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');

const app = express();

// Seguridad con Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configurado para cookies seguras y origen específico
app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir solicitudes del FRONTEND_URL y orígenes locales en desarrollo o sin origen (como Postman/curl)
      if (!origin || origin === config.FRONTEND_URL || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(new Error(`Acceso CORS no permitido para el origen: ${origin}`));
      }
    },
    credentials: true,
  })
);

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Servir estáticos de uploads de forma segura
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Endpoint de verificación de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    name: 'FinanEcuador Demo API',
    version: '1.0.0',
    mode: config.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api', clientRoutes);
app.use('/api/admin', adminRoutes);

// Manejo de 404 y Errores Globales
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
