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

// Logging de peticiones (solo en desarrollo para mejor performance en producción)
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

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
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0, // Sin cache en dev
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
            estadisticasHora: '/api/estadisticas/por-hora?dias=7',
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
            exportarCSV: '/api/sensores/exportar/csv?fechaInicio=2024-11-01&fechaFin=2024-11-30&limit=10000'
        },
        filtros_disponibles: {
            fechas: 'fechaInicio, fechaFin (formato ISO8601)',
            decibeles: 'minDecibeles, maxDecibeles',
            dispositivo: 'devAddr',
            paginacion: 'page, limit',
            ordenamiento: 'sort',
            dias: 'dias (para análisis temporales)'
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
    
    // SPA fallback - cualquier ruta no API devuelve el index.html
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    
    // No enviar detalles de error en producción
    const errorDetails = process.env.NODE_ENV === 'production' 
        ? 'Error interno del servidor'
        : err.message;
    
    res.status(err.status || 500).json({
        success: false,
        error: errorDetails,
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
            serverSelectionTimeoutMS: 5000,
            retryWrites: true,
            w: 'majority'
        });
        
        console.log('✅ MongoDB conectado exitosamente');
        console.log(`📁 Base de datos: ${mongoose.connection.name}`);
        console.log(`📊 Host: ${mongoose.connection.host}`);
        
        // Verificar cantidad de documentos
        const Sensor = require('./models/Sensor');
        const count = await Sensor.countDocuments();
        console.log(`📄 Documentos en sonido_raw: ${count.toLocaleString('es-CO')}`);
        
        // 🔥 NUEVO: Verificar rango de fechas de los datos
        const dateRangeResult = await Sensor.aggregate([
            {
                $group: {
                    _id: null,
                    minDate: { $min: '$time' },
                    maxDate: { $max: '$time' }
                }
            }
        ]);
        
        if (dateRangeResult.length > 0) {
            const minDate = new Date(dateRangeResult[0].minDate);
            const maxDate = new Date(dateRangeResult[0].maxDate);
            console.log(`📅 Rango de datos: ${minDate.toISOString().split('T')[0]} a ${maxDate.toISOString().split('T')[0]}`);
        }
        
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
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Servidor API de Monitoreo Ambiental WS302`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\n📍 URL Principal: http://localhost:${PORT}`);
    console.log(`📄 Dashboard HTML: http://localhost:${PORT}/`);
    console.log(`📊 API Info (JSON): http://localhost:${PORT}/api`);
    console.log(`\n⚙️  Configuración:`);
    console.log(`   • Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   • Puerto: ${PORT}`);
    console.log(`   • CORS: Abierto (*)`);
    console.log(`   • Compresión: Habilitada`);
    console.log(`\n💡 Endpoints principales:`);
    console.log(`   ❤️  Health Check:     GET /api/health`);
    console.log(`   📱 Dispositivos:      GET /api/sensores/devices`);
    console.log(`   📊 Resumen Stats:     GET /api/estadisticas/resumen`);
    console.log(`   📈 Tendencias:        GET /api/estadisticas/tendencias?dias=30`);
    console.log(`   🔋 Estado Baterías:   GET /api/estadisticas/estado-baterias`);
    console.log(`   💾 Exportar CSV:      GET /api/sensores/exportar/csv`);
    console.log(`\n${'='.repeat(60)}\n`);
});

// Configuración de timeouts
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// ==================== GRACEFUL SHUTDOWN ====================

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    
    isShuttingDown = true;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📴 Señal ${signal} recibida. Iniciando shutdown...`);
    console.log(`${'='.repeat(60)}`);
    
    const forceShutdownTimeout = setTimeout(() => {
        console.error('⚠️  Timeout alcanzado. Forzando cierre del servidor...');
        process.exit(1);
    }, 30000);
    
    try {
        // Cerrar servidor HTTP
        console.log('🛑 Cerrando servidor HTTP...');
        await new Promise((resolve, reject) => {
            server.close((err) => err ? reject(err) : resolve());
        });
        console.log('✅ Servidor HTTP cerrado');
        
        // Cerrar conexión MongoDB
        console.log('🛑 Cerrando conexión MongoDB...');
        await mongoose.connection.close(false);
        console.log('✅ MongoDB desconectado');
        
        clearTimeout(forceShutdownTimeout);
        console.log('\n✅ Shutdown completado exitosamente');
        console.log(`${'='.repeat(60)}\n`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante shutdown:', error.message);
        clearTimeout(forceShutdownTimeout);
        process.exit(1);
    }
};

// Escuchar señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Excepción no capturada:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    console.error('Promise:', promise);
    gracefulShutdown('unhandledRejection');
});

module.exports = app;
