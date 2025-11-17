const { getConnection } = require('../config/mysql');
const Sensor = require('../models/Sensor');
const cron = require('node-cron');

class BackupService {
    constructor() {
        this.isBackupRunning = false;
        this.lastBackupDate = null;
        this.backupStats = {
            totalBackups: 0,
            successfulBackups: 0,
            failedBackups: 0,
            lastBackupDuration: 0
        };
    }

    /**
     * Inicializar tablas MySQL
     */
    async initializeTables() {
        try {
            const connection = await getConnection();

            // Tabla principal de mediciones
            await connection.query(`
                CREATE TABLE IF NOT EXISTS sensor_measurements (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    mongo_id VARCHAR(50) UNIQUE NOT NULL,
                    dev_addr VARCHAR(20) NOT NULL,
                    device_name VARCHAR(100),
                    time DATETIME NOT NULL,
                    
                    -- Datos de sonido
                    laeq DECIMAL(10, 2),
                    lai DECIMAL(10, 2),
                    laimax DECIMAL(10, 2),
                    
                    -- Datos de dispositivo
                    battery DECIMAL(5, 2),
                    frequency INT,
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    
                    INDEX idx_time (time),
                    INDEX idx_dev_addr (dev_addr),
                    INDEX idx_device_name (device_name),
                    INDEX idx_laeq (laeq)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            // Tabla de dispositivos
            await connection.query(`
                CREATE TABLE IF NOT EXISTS devices (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    dev_addr VARCHAR(20) UNIQUE NOT NULL,
                    device_name VARCHAR(100),
                    total_measurements INT DEFAULT 0,
                    last_measurement DATETIME,
                    last_battery DECIMAL(5, 2),
                    last_laeq DECIMAL(10, 2),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    
                    INDEX idx_dev_addr (dev_addr)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            // Tabla de logs de backup
            await connection.query(`
                CREATE TABLE IF NOT EXISTS backup_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    backup_date DATETIME NOT NULL,
                    records_processed INT DEFAULT 0,
                    records_inserted INT DEFAULT 0,
                    records_updated INT DEFAULT 0,
                    records_failed INT DEFAULT 0,
                    duration_seconds INT,
                    status VARCHAR(20),
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    INDEX idx_backup_date (backup_date),
                    INDEX idx_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            console.log('✅ Tablas MySQL inicializadas correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando tablas MySQL:', error);
            throw error;
        }
    }

    /**
     * Ejecutar backup completo de MongoDB a MySQL
     */
    async executeBackup(isInitial = false) {
        if (this.isBackupRunning) {
            console.log('⚠️  Ya hay un backup en ejecución');
            return { success: false, message: 'Backup already running' };
        }

        this.isBackupRunning = true;
        const startTime = Date.now();
        const backupDate = new Date();

        let stats = {
            processed: 0,
            inserted: 0,
            updated: 0,
            failed: 0,
            status: 'running'
        };

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔄 Iniciando backup ${isInitial ? 'INICIAL' : 'INCREMENTAL'}: ${backupDate.toISOString()}`);
        console.log(`${'='.repeat(60)}\n`);

        try {
            const connection = await getConnection();

            // Determinar fecha de último backup
            let lastBackupDate = null;
            if (!isInitial) {
                const [lastBackup] = await connection.query(`
                    SELECT MAX(backup_date) as last_date 
                    FROM backup_logs 
                    WHERE status = 'completed'
                `);
                lastBackupDate = lastBackup[0]?.last_date;
            }

            // Construir query de MongoDB
            const mongoQuery = lastBackupDate 
                ? { time: { $gt: new Date(lastBackupDate) } }
                : {};

            // Contar documentos a procesar
            const totalDocs = await Sensor.countDocuments(mongoQuery);
            console.log(`📊 Documentos a procesar: ${totalDocs.toLocaleString('es-CO')}`);

            if (totalDocs === 0) {
                console.log('ℹ️  No hay nuevos datos para respaldar');
                this.isBackupRunning = false;
                return { success: true, message: 'No new data to backup', stats };
            }

            // Procesar en lotes
            const batchSize = parseInt(process.env.BACKUP_BATCH_SIZE) || 1000;
            const totalBatches = Math.ceil(totalDocs / batchSize);

            for (let batch = 0; batch < totalBatches; batch++) {
                const skip = batch * batchSize;
                
                // Obtener lote de MongoDB
                const documents = await Sensor.find(mongoQuery)
                    .skip(skip)
                    .limit(batchSize)
                    .lean();

                console.log(`📦 Procesando lote ${batch + 1}/${totalBatches} (${documents.length} documentos)...`);

                // Preparar datos para MySQL
                for (const doc of documents) {
                    try {
                        const data = {
                            mongo_id: doc._id.toString(),
                            dev_addr: doc.devAddr || '',
                            device_name: doc.deviceInfo?.deviceName || null,
                            time: doc.time,
                            laeq: parseFloat(doc.object?.LAeq) || null,
                            lai: parseFloat(doc.object?.LAI) || null,
                            laimax: parseFloat(doc.object?.LAImax) || null,
                            battery: parseFloat(doc.object?.battery) || null,
                            frequency: parseInt(doc.freq) || null
                        };

                        // Insertar o actualizar en MySQL
                        await connection.query(`
                            INSERT INTO sensor_measurements (
                                mongo_id, dev_addr, device_name, time,
                                laeq, lai, laimax, battery, frequency
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE
                                dev_addr = VALUES(dev_addr),
                                device_name = VALUES(device_name),
                                time = VALUES(time),
                                laeq = VALUES(laeq),
                                lai = VALUES(lai),
                                laimax = VALUES(laimax),
                                battery = VALUES(battery),
                                frequency = VALUES(frequency),
                                updated_at = CURRENT_TIMESTAMP
                        `, [
                            data.mongo_id, data.dev_addr, data.device_name, data.time,
                            data.laeq, data.lai, data.laimax, data.battery, data.frequency
                        ]);

                        stats.inserted++;
                        stats.processed++;

                        // Actualizar tabla de dispositivos
                        if (data.dev_addr) {
                            await connection.query(`
                                INSERT INTO devices (
                                    dev_addr, device_name, total_measurements,
                                    last_measurement, last_battery, last_laeq
                                ) VALUES (?, ?, 1, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE
                                    device_name = VALUES(device_name),
                                    total_measurements = total_measurements + 1,
                                    last_measurement = VALUES(last_measurement),
                                    last_battery = VALUES(last_battery),
                                    last_laeq = VALUES(last_laeq),
                                    updated_at = CURRENT_TIMESTAMP
                            `, [
                                data.dev_addr, data.device_name, data.time,
                                data.battery, data.laeq
                            ]);
                        }

                    } catch (docError) {
                        console.error(`❌ Error procesando documento ${doc._id}:`, docError.message);
                        stats.failed++;
                    }
                }

                // Progress bar
                const progress = ((batch + 1) / totalBatches * 100).toFixed(1);
                console.log(`📈 Progreso: ${progress}% (${stats.inserted}/${totalDocs} registros)`);
            }

            // Registrar log de backup
            const duration = Math.round((Date.now() - startTime) / 1000);
            stats.status = 'completed';

            await connection.query(`
                INSERT INTO backup_logs (
                    backup_date, records_processed, records_inserted,
                    records_updated, records_failed, duration_seconds, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                backupDate, stats.processed, stats.inserted,
                stats.updated, stats.failed, duration, stats.status
            ]);

            // Actualizar estadísticas
            this.backupStats.totalBackups++;
            this.backupStats.successfulBackups++;
            this.backupStats.lastBackupDuration = duration;
            this.lastBackupDate = backupDate;

            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ Backup completado exitosamente`);
            console.log(`${'='.repeat(60)}`);
            console.log(`📊 Estadísticas:`);
            console.log(`   • Procesados: ${stats.processed.toLocaleString('es-CO')}`);
            console.log(`   • Insertados: ${stats.inserted.toLocaleString('es-CO')}`);
            console.log(`   • Fallidos: ${stats.failed}`);
            console.log(`   • Duración: ${duration}s`);
            console.log(`${'='.repeat(60)}\n`);

            return { success: true, stats, duration };

        } catch (error) {
            console.error('❌ Error ejecutando backup:', error);
            stats.status = 'failed';
            this.backupStats.failedBackups++;

            // Registrar error en MySQL
            try {
                const connection = await getConnection();
                const duration = Math.round((Date.now() - startTime) / 1000);
                
                await connection.query(`
                    INSERT INTO backup_logs (
                        backup_date, records_processed, records_inserted,
                        records_updated, records_failed, duration_seconds,
                        status, error_message
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    backupDate, stats.processed, stats.inserted,
                    stats.updated, stats.failed, duration,
                    'failed', error.message
                ]);
            } catch (logError) {
                console.error('❌ Error registrando log de backup:', logError);
            }

            return { success: false, error: error.message, stats };

        } finally {
            this.isBackupRunning = false;
        }
    }

    /**
     * Programar backup diario automático
     */
    scheduleDaily() {
        if (process.env.BACKUP_ENABLED !== 'true') {
            console.log('ℹ️  Backups automáticos deshabilitados');
            return;
        }

        const backupTime = process.env.BACKUP_TIME || '02:00';
        const [hour, minute] = backupTime.split(':');

        // Programar tarea cron (formato: minuto hora * * *)
        const cronExpression = `${minute} ${hour} * * *`;
        
        cron.schedule(cronExpression, async () => {
            console.log(`⏰ Ejecutando backup programado: ${new Date().toISOString()}`);
            await this.executeBackup(false);
        }, {
            timezone: "America/Bogota"
        });

        console.log(`⏰ Backup diario programado para las ${backupTime} (hora de Colombia)`);
    }

    /**
     * Obtener estadísticas de backups
     */
    async getBackupStats() {
        try {
            const connection = await getConnection();

            const [logs] = await connection.query(`
                SELECT 
                    COUNT(*) as total_backups,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    MAX(backup_date) as last_backup,
                    AVG(duration_seconds) as avg_duration,
                    SUM(records_inserted) as total_records
                FROM backup_logs
                WHERE backup_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            `);

            const [deviceCount] = await connection.query(`
                SELECT COUNT(*) as total FROM devices
            `);

            const [measurementCount] = await connection.query(`
                SELECT COUNT(*) as total FROM sensor_measurements
            `);

            return {
                ...this.backupStats,
                database: {
                    devices: deviceCount[0].total,
                    measurements: measurementCount[0].total
                },
                last30Days: logs[0]
            };
        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            return this.backupStats;
        }
    }
}

module.exports = new BackupService();
