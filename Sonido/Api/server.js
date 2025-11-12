require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const compression = require('compression');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Importar rutas
const sensorRoutes = require('./routes/sensores');
const estadisticasRoutes = require('./routes/estadisticas');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== SEGURIDAD ====================

// Deshabilita el header X-Powered-By para reducir fingerprinting
app.disable('x-powered-by');

// Configura headers de seguridad HTTP con Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Deshabilitado para API pública
  crossOriginEmbedderPolicy: false
}));

// ==================== ACCESO PÚBLICO (SIN CORS) ====================

// Configura headers para acceso público sin restricciones
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Responde inmediatamente a peticiones OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// ==================== RATE LIMITING ====================

// Limitador global para prevenir abuso de API pública
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 peticiones por IP
  message: {
    success: false,
    error: 'Demasiadas peticiones. Intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health' // Excluye health check
});

app.use(globalLimiter);

// ==================== MIDDLEWARE ====================

// Parsea el body de las peticiones JSON y URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Comprime las respuestas HTTP para reducir ancho de banda
app.use(compression());

// Logger de peticiones HTTP en consola
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ==================== RUTAS DE API ====================

// Health check para monitoreo (sin rate limiting)
app.use('/api/health', healthRoutes);

// Rutas principales de la aplicación
app.use('/api/sensores', sensorRoutes);
app.use('/api/estadisticas', estadisticasRoutes);

// ==================== ARCHIVOS ESTÁTICOS ====================

// Sirve archivos del directorio public con cache
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// Ruta raíz que sirve el HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== MANEJO DE ERRORES ====================

// Handler para rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Handler global de errores
app.use((err, req, res, next) => {
  // Log del error en servidor
  console.error('❌ Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });
  
  // Respuesta genérica para no exponer información sensible
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==================== MONGODB ====================

// Intenta conectar a MongoDB con reintentos automáticos
async function connectMongoDB() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true
    });
    
    console.log('✅ MongoDB conectado exitosamente');
    console.log(`📁 Base de datos: ${process.env.DB_NAME}`);
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    console.log('🔄 Reintentando conexión en 5 segundos...');
    setTimeout(connectMongoDB, 5000);
  }
}

// Maneja eventos de conexión de MongoDB
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB desconectado');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Error en MongoDB:', err.message);
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconectado');
});

// ==================== SERVIDOR ====================

// Inicia la conexión a MongoDB
connectMongoDB();

// Inicia el servidor HTTP
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Servidor ejecutándose en: http://localhost:${PORT}`);
  console.log(`📊 API disponible en: http://localhost:${PORT}/api`);
  console.log(`🌍 Acceso: Público sin restricciones`);
  console.log(`⚙️  Entorno: ${process.env.NODE_ENV || 'development'}\n`);
});

// Configura timeout para peticiones HTTP
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// ==================== GRACEFUL SHUTDOWN ====================

// Variable para controlar el estado de shutdown
let isShuttingDown = false;

// Función para cerrar el servidor de forma segura
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('⏳ Shutdown ya en proceso...');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n📴 Señal ${signal} recibida`);
  console.log('🔄 Iniciando cierre graceful...');
  
  // Timeout de seguridad: fuerza cierre después de 30 segundos
  const forceShutdownTimeout = setTimeout(() => {
    console.error('⚠️  Forzando cierre del servidor (timeout)');
    process.exit(1);
  }, 30000);
  
  try {
    // Deja de aceptar nuevas conexiones
    console.log('🛑 Cerrando servidor HTTP...');
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✅ Servidor HTTP cerrado');
    
    // Cierra la conexión a MongoDB
    console.log('🛑 Cerrando conexión MongoDB...');
    await mongoose.connection.close(false);
    console.log('✅ MongoDB desconectado');
    
    // Limpia el timeout
    clearTimeout(forceShutdownTimeout);
    
    console.log('✅ Shutdown completado exitosamente\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante shutdown:', error.message);
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
};

// Captura señales de terminación del proceso
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Captura excepciones no manejadas
process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;
