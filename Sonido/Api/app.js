// Uso en tu app.js 

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const compression = require('compression');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

// Importar middlewares personalizados
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');
const requestLogger = require('./middleware/requestLogger');

// Importar rutas
const sensorRoutes = require('./routes/sensores');
const estadisticasRoutes = require('./routes/estadisticas');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// Crea directorio de logs si no existe
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// ==================== SEGURIDAD ====================

app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// ==================== ACCESO PÚBLICO ====================

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// ==================== RATE LIMITING ====================

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Demasiadas peticiones. Intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health'
});

app.use(globalLimiter);

// ==================== MIDDLEWARE ====================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(compression());

// Logger HTTP con Winston stream
app.use(morgan('combined', { stream: logger.stream }));

// Logger personalizado de requests (opcional)
app.use(requestLogger);

// ==================== RUTAS DE API ====================

app.use('/api/health', healthRoutes);
app.use('/api/sensores', sensorRoutes);
app.use('/api/estadisticas', estadisticasRoutes);

// ==================== ARCHIVOS ESTÁTICOS ====================

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== MANEJO DE ERRORES ====================

// 404 - Debe ir ANTES del error handler global
app.use((req, res) => {
  logger.warn(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, {
    ip: req.ip
  });
  
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handler global - DEBE SER EL ÚLTIMO MIDDLEWARE
app.use(errorHandler);

// ==================== MONGODB ====================

async function connectMongoDB() {
  try {
    logger.info('Conectando a MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true
    });
    
    logger.info(`MongoDB conectado - Base de datos: ${process.env.DB_NAME}`);
  } catch (error) {
    logger.error(`Error conectando a MongoDB: ${error.message}`);
    logger.info('Reintentando conexión en 5 segundos...');
    setTimeout(connectMongoDB, 5000);
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB desconectado');
});

mongoose.connection.on('error', (err) => {
  logger.error(`Error en MongoDB: ${err.message}`);
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconectado');
});

// ==================== SERVIDOR ====================

connectMongoDB();

const server = app.listen(PORT, () => {
  logger.info(`Servidor ejecutándose en puerto ${PORT}`);
  logger.info(`Acceso: Público sin restricciones`);
  logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// ==================== GRACEFUL SHUTDOWN ====================

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  logger.info(`Señal ${signal} recibida - Iniciando cierre graceful`);
  
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Forzando cierre del servidor (timeout)');
    process.exit(1);
  }, 30000);
  
  try {
    logger.info('Cerrando servidor HTTP...');
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    logger.info('Servidor HTTP cerrado');
    
    logger.info('Cerrando conexión MongoDB...');
    await mongoose.connection.close(false);
    logger.info('MongoDB desconectado');
    
    clearTimeout(forceShutdownTimeout);
    logger.info('Shutdown completado exitosamente');
    process.exit(0);
  } catch (error) {
    logger.error(`Error durante shutdown: ${error.message}`);
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Excepción no capturada', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promesa rechazada no manejada', { reason });
  gracefulShutdown('unhandledRejection');
});

module.exports = app;
