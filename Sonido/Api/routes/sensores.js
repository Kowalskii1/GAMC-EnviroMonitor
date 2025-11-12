const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const { param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Rate limiter para operaciones costosas (exportación y búsqueda avanzada)
const heavyOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 solicitudes
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter para exportaciones específicamente
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // Máximo 10 exportaciones por hora
  message: {
    success: false,
    error: 'Límite de exportaciones alcanzado. Intenta en 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Obtiene todos los datos con filtros opcionales (paginación, rango de fechas, etc.)
router.get('/datos', [
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Límite debe ser entre 1 y 1000'),
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser mayor a 0')
], sensorController.getDatos);

// Obtiene un registro específico por su ID de MongoDB
router.get('/datos/:id', [
  param('id').isMongoId().withMessage('ID de MongoDB inválido')
], sensorController.getDatoById);

// Obtiene las últimas N mediciones ordenadas por fecha descendente
router.get('/ultimas', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe ser entre 1 y 100')
], sensorController.getUltimas);

// Obtiene datos dentro de un rango de fechas específico
router.get('/rango-fechas', [
  query('inicio').isISO8601().withMessage('Fecha inicio debe ser formato ISO8601'),
  query('fin').isISO8601().withMessage('Fecha fin debe ser formato ISO8601')
], sensorController.getRangoFechas);

// Búsqueda con múltiples filtros y criterios personalizados
router.get('/buscar', heavyOperationLimiter, sensorController.buscarAvanzado);

// Exporta los datos filtrados a formato CSV para descarga
router.get('/exportar/csv', exportLimiter, [
  query('inicio').optional().isISO8601(),
  query('fin').optional().isISO8601()
], sensorController.exportarCSV);

// Calcula estadísticas agregadas por hora (promedios, máximos, mínimos)
router.get('/estadisticas/hora', sensorController.estadisticasHora);

// Calcula estadísticas agregadas por día
router.get('/estadisticas/dia', sensorController.estadisticasDia);

// Obtiene alertas cuando los valores exceden umbrales configurados
router.get('/alertas', [
  query('umbral').optional().isFloat({ min: 0 }).withMessage('Umbral debe ser número positivo')
], sensorController.getAlertas);

module.exports = router;
