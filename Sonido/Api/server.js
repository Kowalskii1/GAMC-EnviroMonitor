require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Importar rutas
const sensorRoutes = require('./routes/sensores');
const estadisticasRoutes = require('./routes/estadisticas');
const healthRoutes = require('./routes/health');

// Importar middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================

// Helmet para seguridad
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: { action: 'sameorigin' }
}));

// Compresión
app.use(compression());

// Logging
app.use(morgan('combined', { stream: logger.stream }));

// CORS abierto (sin restricciones)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==================== RUTAS ====================

// Health check
app.use('/api/health', healthRoutes);

// Rutas principales
app.use('/api/sensores', sensorRoutes);
app.use('/api/estadisticas', estadisticasRoutes);

// Servir frontend estático
app.use(express.static(path.join(__dirname, 'public')));

// Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Manejo de errores global
app.use(errorHandler);

// ==================== CONEXIÓN MONGODB ====================

async function connectMongoDB() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: process.env.DB_NAME,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB conectado exitosamente');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    setTimeout(connectMongoDB, 5000);
  }
}

// ==================== INICIAR SERVIDOR ====================

connectMongoDB();

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📍 Ambiente: ${process.env.NODE_ENV}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📊 API disponible en http://localhost:${PORT}/api\n`);
});

// Manejo de señales
process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM recibido, cerrando gracefully...');
  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
});

module.exports = app;
