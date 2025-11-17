const path = require('path');

if (!process.env.HTTP_PLATFORM_PORT) {
    const dotenv = require('dotenv');
    const envFiles = [
        path.join(__dirname, '.env.production'),
        path.join(__dirname, '.env')
    ];
    
    let loaded = false;
    for (const envFile of envFiles) {
        const result = dotenv.config({ path: envFile });
        if (!result.error) {
            console.log(`✅ Variables cargadas desde: ${path.basename(envFile)}`);
            loaded = true;
            break;
        }
    }
    
    if (!loaded) {
        console.warn('⚠️  No se encontró archivo .env');
    }
} else {
    console.log('✅ Variables cargadas desde web.config (MonsterASP)');
}

const express = require('express');
const mongoose = require('mongoose');
const compression = require('compression');
const morgan = require('morgan');

const sensorRoutes = require('./routes/sensores');
const estadisticasRoutes = require('./routes/estadisticas');
const healthRoutes = require('./routes/health');
const backupRoutes = require('./routes/backup');

const soterradosRoutes = require('./routes/soterrados');

const { connectMySQL, closeMySQL } = require('./config/mysql');
const backupService = require('./services/backupService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());

if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    index: 'index.html'
}));

app.use('/api/sensores', sensorRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/soterrados', soterradosRoutes);

app.get('/api', (req, res) => {
    res.json({
        message: 'API de Monitoreo de Ruido Ambiental - LoRaWAN WS302',
        version: '3.1.0',
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
                resumen: '/api/estadisticas/resumen',
                porHora: '/api/estadisticas/por-hora',
                comparacionDias: '/api/estadisticas/comparacion-dias',
                porDiaSemana: '/api/estadisticas/por-dia-semana',
                tendencias: '/api/estadisticas/tendencias',
                comparacionDispositivos: '/api/estadisticas/comparacion-dispositivos',
                dispositivosRanking: '/api/estadisticas/dispositivos-ranking',
                cumplimientoNormativo: '/api/estadisticas/cumplimiento-normativo',
                picosRuido: '/api/estadisticas/picos-ruido',
                estadoBaterias: '/api/estadisticas/estado-baterias',
                historialBateria: '/api/estadisticas/historial-bateria/:devAddr'
            },
            backup: {
                status: '/api/backup/status',
                execute: '/api/backup/execute',
                logs: '/api/backup/logs',
                verify: '/api/backup/verify'
            },
            health: '/api/health'
        },
        ejemplos: {
            obtenerDatos: '/api/sensores/datos?limit=10&page=1',
            filtrarPorDecibeles: '/api/sensores/datos?minDecibeles=50&maxDecibeles=80',
            ultimas10: '/api/sensores/ultimas?cantidad=10',
            dispositivos: '/api/sensores/devices',
            resumenCompleto: '/api/estadisticas/resumen',
            estadisticasHora: '/api/estadisticas/por-hora?dias=7',
            comparacionSemanal: '/api/estadisticas/comparacion-dias?dias=7',
            patronesDiaSemana: '/api/estadisticas/por-dia-semana?dias=30',
            tendencias: '/api/estadisticas/tendencias?dias=30',
            rankingDispositivos: '/api/estadisticas/dispositivos-ranking?metrica=promedio',
            cumplimiento: '/api/estadisticas/cumplimiento-normativo?umbralDia=70&umbralNoche=60',
            picosRuido: '/api/estadisticas/picos-ruido?dias=7',
            estadoBaterias: '/api/estadisticas/estado-baterias',
            historialBateria: '/api/estadisticas/historial-bateria/008ac7ec?dias=30',
            exportarCSV: '/api/sensores/exportar/csv?fechaInicio=2024-11-01&fechaFin=2024-11-30&limit=10000',
            estadoBackup: '/api/backup/status',
            ejecutarBackup: '/api/backup/execute',
            historialBackup: '/api/backup/logs?limit=20',
            verificarIntegridad: '/api/backup/verify'
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    
    const errorDetails = process.env.NODE_ENV === 'production' 
        ? 'Error interno del servidor'
        : err.message;
    
    res.status(err.status || 500).json({
        success: false,
        error: errorDetails,
        timestamp: new Date().toISOString()
    });
});

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
        
        const Sensor = require('./models/Sensor');
        const count = await Sensor.countDocuments();
        console.log(`📄 Documentos en sonido_raw: ${count.toLocaleString('es-CO')}`);
        
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

mongoose.connection.on('error', err => {
    console.error('❌ Error de MongoDB:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB desconectado. Intentando reconectar...');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconectado');
});

async function initializeBackupSystem() {
    try {
        console.log('\n🔄 Inicializando sistema de backup...');
        
        await connectMySQL();
        await backupService.initializeTables();
        backupService.scheduleDaily();
        
        console.log('✅ Sistema de backup inicializado correctamente\n');
        
        const stats = await backupService.getBackupStats();
        if (stats.database) {
            console.log('📊 Estado actual del backup:');
            console.log(`   • Dispositivos en MySQL: ${stats.database.devices}`);
            console.log(`   • Mediciones en MySQL: ${stats.database.measurements.toLocaleString('es-CO')}`);
            if (stats.last30Days) {
                console.log(`   • Backups últimos 30 días: ${stats.last30Days.total_backups}`);
                console.log(`   • Último backup: ${stats.last30Days.last_backup || 'Nunca'}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error inicializando sistema de backup:', error.message);
        console.log('⚠️  El servidor continuará sin sistema de backup');
    }
}

connectMongoDB();

setTimeout(() => {
    initializeBackupSystem();
}, 2000);

const server = app.listen(PORT, () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 Servidor API de Monitoreo Ambiental WS302`);
    console.log(`${'='.repeat(70)}`);
    console.log(`\n📍 URL Principal: http://localhost:${PORT}`);
    console.log(`📄 Dashboard HTML: http://localhost:${PORT}/`);
    console.log(`📊 API Info (JSON): http://localhost:${PORT}/api`);
    console.log(`\n⚙️  Configuración:`);
    console.log(`   • Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   • Puerto: ${PORT}`);
    console.log(`   • CORS: Abierto (*)`);
    console.log(`   • Compresión: Habilitada`);
    console.log(`   • Backup automático: ${process.env.BACKUP_ENABLED === 'true' ? 'Activado' : 'Desactivado'}`);
    if (process.env.BACKUP_ENABLED === 'true') {
        console.log(`   • Hora de backup: ${process.env.BACKUP_TIME || '02:00'} (hora Colombia)`);
    }
    console.log(`\n💡 Endpoints principales:`);
    console.log(`   ❤️  Health Check:     GET /api/health`);
    console.log(`   📱 Dispositivos:      GET /api/sensores/devices`);
    console.log(`   📊 Resumen Stats:     GET /api/estadisticas/resumen`);
    console.log(`   📈 Tendencias:        GET /api/estadisticas/tendencias?dias=30`);
    console.log(`   🔋 Estado Baterías:   GET /api/estadisticas/estado-baterias`);
    console.log(`   💾 Exportar CSV:      GET /api/sensores/exportar/csv`);
    console.log(`\n🔥 Endpoints de Backup:`);
    console.log(`   📊 Estado backup:     GET /api/backup/status`);
    console.log(`   ▶️  Ejecutar backup:   POST /api/backup/execute`);
    console.log(`   📝 Historial backup:  GET /api/backup/logs`);
    console.log(`   ✅ Verificar datos:   GET /api/backup/verify`);
    console.log(`\n${'='.repeat(70)}\n`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    
    isShuttingDown = true;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📴 Señal ${signal} recibida. Iniciando shutdown...`);
    console.log(`${'='.repeat(70)}`);
    
    const forceShutdownTimeout = setTimeout(() => {
        console.error('⚠️  Timeout alcanzado. Forzando cierre del servidor...');
        process.exit(1);
    }, 30000);
    
    try {
        console.log('🛑 Cerrando servidor HTTP...');
        await new Promise((resolve, reject) => {
            server.close((err) => err ? reject(err) : resolve());
        });
        console.log('✅ Servidor HTTP cerrado');
        
        console.log('🛑 Cerrando conexión MySQL...');
        await closeMySQL();
        
        console.log('🛑 Cerrando conexión MongoDB...');
        await mongoose.connection.close(false);
        console.log('✅ MongoDB desconectado');
        
        clearTimeout(forceShutdownTimeout);
        console.log('\n✅ Shutdown completado exitosamente');
        console.log(`${'='.repeat(70)}\n`);
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

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    console.error('Promise:', promise);
    gracefulShutdown('unhandledRejection');
});

module.exports = app;
