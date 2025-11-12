require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Importar rutas
const sensorRoutes = require('./routes/sensores');
const estadisticasRoutes = require('./routes/estadisticas');
const healthRoutes = require('./routes/health');

// Importar middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CONFIGURACIÓN ESTRICTA ====================

// Deshabilitar X-Powered-By
app.disable('x-powered-by');

// ==================== CORS (PRIMERO DE TODO) ====================
app.use((req, res, next) => {
  // Establecer headers CORS una sola vez
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Manejar preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// ==================== MIDDLEWARE ====================

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Compresión
app.use(compression());

// Logging simple
app.use(morgan('dev'));

// ==================== RUTAS ====================

// Health check (primero)
app.use('/api/health', healthRoutes);

// Rutas de sensores
app.use('/api/sensores', sensorRoutes);

// Rutas de estadísticas
app.use('/api/estadisticas', estadisticasRoutes);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    // No sobrescribir CORS en archivos estáticos
  }
}));

// Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==================== MONGODB ====================

async function connectMongoDB() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: process.env.DB_NAME,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB conectado');
  } catch (error) {
    console.error('❌ Error MongoDB:', error.message);
    setTimeout(connectMongoDB, 5000);
  }
}

// ==================== INICIAR ====================

connectMongoDB();

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Servidor: http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log(`⚠️  CORS: Abierto sin restricciones\n`);
});

// Manejo graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n📴 ${signal} recibido, cerrando...`);
  server.close(async () => {
    await mongoose.connection.close();
    console.log('✅ Servidor cerrado');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
