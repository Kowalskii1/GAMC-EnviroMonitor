require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const compression = require('compression');
const morgan = require('morgan');

// Importar rutas
const sensorRoutes = require('./routes/sensores');
const estadisticasRoutes = require('./routes/estadisticas');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARES ====================

// Compresión de respuestas
app.use(compression());

// Logging de peticiones
app.use(morgan('combined'));

// Parseo de JSON y URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS completamente abierto
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==================== RUTAS ====================

app.use('/api/sensores', sensorRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/health', healthRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'API de Monitoreo de Ruido Ambiental',
    version: '1.0.0',
    endpoints: {
      sensores: '/api/sensores',
      estadisticas: '/api/estadisticas',
      health: '/api/health'
    }
  });
});

// ==================== MANEJO DE ERRORES ====================

// Middleware para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

// ==================== CONEXIÓN A MONGODB ====================

mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  console.log('✓ Conectado a MongoDB');
  
  // Inicia el servidor solo después de conectar a la BD
  app.listen(PORT, () => {
    console.log(`✓ Servidor ejecutándose en puerto ${PORT}`);
    console.log(`✓ Entorno: ${process.env.NODE_ENV || 'development'}`);
  });
})
.catch(err => {
  console.error('✗ Error de conexión a MongoDB:', err);
  process.exit(1);
});

// Manejo de errores de MongoDB
mongoose.connection.on('error', err => {
  console.error('Error de MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB desconectado. Intentando reconectar...');
});

// ==================== GRACEFUL SHUTDOWN ====================

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} recibido. Cerrando conexiones...`);
  
  try {
    await mongoose.connection.close();
    console.log('✓ MongoDB desconectado');
    process.exit(0);
  } catch (err) {
    console.error('Error al cerrar conexiones:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
