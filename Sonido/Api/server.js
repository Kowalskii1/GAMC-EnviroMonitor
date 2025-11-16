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

// CORS completamente abierto - SIN RESTRICCIONES
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==================== ARCHIVOS ESTÁTICOS ====================

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true,
  index: 'index.html'
}));

// ==================== RUTAS DE API ====================

app.use('/api/sensores', sensorRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/health', healthRoutes);

// Ruta API info (solo JSON, no HTML)
app.get('/api', (req, res) => {
  res.json({
    message: 'API de Monitoreo de Ruido Ambiental - LoRaWAN WS302',
    version: '3.0.0',
    database: 'emergentes',
    coleccion: 'sonido_raw',
    totalDocuments: '3,792+',
    documentacion: `${req.protocol}://${req.get('host')}/`,
    endpoints: {
      sensores: {
        datos: '/api/sensores/datos',
        ultimas: '/api/sensores/ultimas',
        buscar: '/api/sensores/buscar',
        devices: '/api/sensores/devices',
        exportarCSV: '/api/sensores/exportar/csv',
        alertas: '/api/sensores/alertas',
        rangoFechas: '/api/sensores/rango-fechas',
        estadisticasHora: '/api/sensores/estadisticas/hora',
        estadisticasDia: '/api/sensores/estadisticas/dia'
      },
      estadisticas: {
        // Análisis básico
        resumen: '/api/estadisticas/resumen',
        porHora: '/api/estadisticas/por-hora',
        comparacionDias: '/api/estadisticas/comparacion-dias',
        
        // Análisis temporal avanzado
        porDiaSemana: '/api/estadisticas/por-dia-semana',
        tendencias: '/api/estadisticas/tendencias',
        
        // Análisis por dispositivo
        comparacionDispositivos: '/api/estadisticas/comparacion-dispositivos',
        dispositivosRanking: '/api/estadisticas/dispositivos-ranking',
        
        // Cumplimiento normativo
        cumplimientoNormativo: '/api/estadisticas/cumplimiento-normativo',
        picosRuido: '/api/estadisticas/picos-ruido',
        
        // Gestión de baterías
        estadoBaterias: '/api/estadisticas/estado-baterias',
        historialBateria: '/api/estadisticas/historial-bateria/:devAddr'
      },
      health: '/api/health'
    },
    ejemplos: {
      // Consultas básicas
      obtenerDatos: '/api/sensores/datos?limit=10&page=1',
      filtrarPorDecibeles: '/api/sensores/datos?minDecibeles=50&maxDecibeles=80',
      ultimas10: '/api/sensores/ultimas?cantidad=10',
      dispositivos: '/api/sensores/devices',
      
      // Estadísticas
      resumenCompleto: '/api/estadisticas/resumen',
      estadisticasHora: '/api/estadisticas/por-hora?fecha=2024-11-15',
      comparacionSemanal: '/api/estadisticas/comparacion-dias?dias=7',
      patronesDiaSemana: '/api/estadisticas/por-dia-semana?dias=30',
      
      // Análisis avanzado
      tendencias: '/api/estadisticas/tendencias?dias=30',
      rankingDispositivos: '/api/estadisticas/dispositivos-ranking?metrica=promedio',
      cumplimiento: '/api/estadisticas/cumplimiento-normativo?umbralDia=70&umbralNoche=60',
      picosRuido: '/api/estadisticas/picos-ruido?dias=7',
      
      // Gestión de dispositivos
      estadoBaterias: '/api/estadisticas/estado-baterias',
      historialBateria: '/api/estadisticas/historial-bateria/008ac7ec?dias=30',
      
      // Exportación
      exportarCSV: '/api/sensores/exportar/csv?fechaInicio=2024-11-01&fechaFin=2024-11-15'
    },
    filtros_disponibles: {
      fechas: 'fechaInicio, fechaFin (formato ISO8601)',
      decibeles: 'minDecibeles, maxDecibeles',
      dispositivo: 'devAddr',
      paginacion: 'page, limit',
      ordenamiento: 'sort'
    },
    metricas_soportadas: {
      LAeq: 'Nivel de presión sonora continuo equivalente',
      LAI: 'Nivel de presión sonora con ponderación temporal I',
      LAImax: 'Nivel máximo de presión sonora LAI',
      battery: 'Nivel de batería del sensor (%)'
    }
  });
});

// ==================== RUTA RAÍZ ====================

// La ruta raíz sirve el index.html de la carpeta public
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== MANEJO DE ERRORES ====================

// Middleware para rutas no encontradas
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'Endpoint no encontrado',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      ayuda: 'Visita GET /api para ver todos los endpoints disponibles'
    });
  }
  
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

// ==================== CONEXIÓN A MONGODB ====================

async function connectMongoDB() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000
    });
    
    console.log('✅ MongoDB conectado exitosamente');
    console.log(`📁 Base de datos: emergentes`);
    console.log(`📊 Colección: sonido_raw`);
    
    // Verificar cantidad de documentos
    const Sensor = require('./models/Sensor');
    const count = await Sensor.countDocuments();
    console.log(`📄 Documentos encontrados: ${count.toLocaleString('es-CO')}`);
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    console.log('🔄 Reintentando conexión en 5 segundos...');
    setTimeout(connectMongoDB, 5000);
  }
}

// Manejo de eventos de MongoDB
mongoose.connection.on('error', err => {
  console.error('❌ Error de MongoDB:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB desconectado. Intentando reconectar...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconectado');
});

// ==================== INICIAR SERVIDOR ====================

connectMongoDB();

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Servidor ejecutándose en: http://localhost:${PORT}`);
  console.log(`📄 Documentación (HTML): http://localhost:${PORT}/`);
  console.log(`📊 API Info (JSON): http://localhost:${PORT}/api`);
  console.log(`🌍 Acceso: Público sin restricciones`);
  console.log(`⚙️  Entorno: ${process.env.NODE_ENV || 'production'}`);
  console.log(`\n💡 Endpoints principales:`);
  console.log(`   📋 GET http://localhost:${PORT}/api`);
  console.log(`   ❤️  GET http://localhost:${PORT}/api/health`);
  console.log(`   📱 GET http://localhost:${PORT}/api/sensores/devices`);
  console.log(`   📊 GET http://localhost:${PORT}/api/estadisticas/resumen`);
  console.log(`   📈 GET http://localhost:${PORT}/api/estadisticas/tendencias`);
  console.log(`   🔋 GET http://localhost:${PORT}/api/estadisticas/estado-baterias\n`);
});

// Configuración de timeouts
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// ==================== GRACEFUL SHUTDOWN ====================

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  console.log(`\n📴 Señal ${signal} recibida. Cerrando conexiones...`);
  
  const forceShutdownTimeout = setTimeout(() => {
    console.error('⚠️  Forzando cierre del servidor');
    process.exit(1);
  }, 30000);
  
  try {
    console.log('🛑 Cerrando servidor HTTP...');
    await new Promise((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve());
    });
    console.log('✅ Servidor HTTP cerrado');
    
    console.log('🛑 Cerrando conexión MongoDB...');
    await mongoose.connection.close(false);
    console.log('✅ MongoDB desconectado');
    
    clearTimeout(forceShutdownTimeout);
    console.log('✅ Shutdown completado\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante shutdown:', error.message);
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;
