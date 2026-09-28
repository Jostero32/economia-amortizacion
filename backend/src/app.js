const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const publicRoutes = require('./routes/publicRoutes');
const clientRoutes = require('./routes/clientRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');
const { UPLOADS_DIR } = require('./services/storage/documentStorage');

const app = express();
const frontendOrigin = new URL(config.FRONTEND_URL).origin;

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
      // Comparar el origen real; un dominio que solo contenga "localhost" no es local.
      let localDevelopment = false;
      if (origin && config.NODE_ENV !== 'production') {
        try {
          const url = new URL(origin);
          localDevelopment = ['http:', 'https:'].includes(url.protocol)
            && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        } catch {
          // Un origen mal formado no puede usar cookies de la aplicación.
        }
      }
      if (!origin || origin === frontendOrigin || localDevelopment) {
        callback(null, true);
      } else {
        const corsError = new Error('Origen no permitido para acceder a la API.');
        corsError.statusCode = 403;
        callback(corsError);
      }
    },
    credentials: true,
  })
);

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Los documentos de las solicitudes solo se entregan por /api/documents/:id con control de acceso
app.use('/uploads/documentos', notFoundHandler);
app.use('/api/uploads/documentos', notFoundHandler);
// Estáticos públicos de uploads (logotipo institucional). También bajo /api: detrás de un proxy
// con prefijo (p. ej. /economia/simulador/api) solo las rutas /api llegan al backend.
const publicUploads = express.static(UPLOADS_DIR, { index: false, dotfiles: 'deny' });
app.use('/uploads', publicUploads);
app.use('/api/uploads', publicUploads);

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
