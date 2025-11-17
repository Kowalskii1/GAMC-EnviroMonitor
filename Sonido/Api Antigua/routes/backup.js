const express = require('express');
const router = express.Router();
const backupService = require('../services/backupService');
const { getConnection } = require('../config/mysql');

/**
 * GET /api/backup/status
 * Estado actual del sistema de backup
 */
router.get('/status', async (req, res) => {
    try {
        const stats = await backupService.getBackupStats();
        
        res.json({
            success: true,
            isRunning: backupService.isBackupRunning,
            lastBackup: backupService.lastBackupDate,
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/backup/execute
 * Ejecutar backup manual
 */
router.post('/execute', async (req, res) => {
    try {
        const { initial = false } = req.body;
        
        if (backupService.isBackupRunning) {
            return res.status(409).json({
                success: false,
                message: 'Ya hay un backup en ejecución'
            });
        }

        // Ejecutar backup en background
        backupService.executeBackup(initial)
            .then(result => {
                console.log('✅ Backup manual completado:', result);
            })
            .catch(error => {
                console.error('❌ Error en backup manual:', error);
            });

        res.json({
            success: true,
            message: 'Backup iniciado en background',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/backup/logs
 * Historial de backups
 */
router.get('/logs', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const connection = await getConnection();

        const [logs] = await connection.query(`
            SELECT 
                id, backup_date, records_processed, records_inserted,
                records_updated, records_failed, duration_seconds,
                status, error_message, created_at
            FROM backup_logs
            ORDER BY backup_date DESC
            LIMIT ?
        `, [parseInt(limit)]);

        res.json({
            success: true,
            data: logs,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/backup/verify
 * Verificar integridad de datos
 */
router.get('/verify', async (req, res) => {
    try {
        const Sensor = require('../models/Sensor');
        const connection = await getConnection();

        // Contar documentos en MongoDB
        const mongoCount = await Sensor.countDocuments();

        // Contar registros en MySQL
        const [mysqlCount] = await connection.query(`
            SELECT COUNT(*) as total FROM sensor_measurements
        `);

        const difference = mongoCount - mysqlCount[0].total;
        const percentage = (mysqlCount[0].total / mongoCount * 100).toFixed(2);

        res.json({
            success: true,
            verification: {
                mongodb: mongoCount,
                mysql: mysqlCount[0].total,
                difference,
                percentage: `${percentage}%`,
                status: difference === 0 ? 'synced' : 'pending'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
