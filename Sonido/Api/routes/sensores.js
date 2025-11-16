const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const { param, query } = require('express-validator');

// Obtiene todos los datos con filtros opcionales
router.get('/datos', [
  query('fechaInicio').optional().isISO8601().withMessage('fechaInicio debe ser formato ISO8601'),
  query('fechaFin').optional().isISO8601().withMessage('fechaFin debe ser formato ISO8601'),
  query('minDecibeles').optional().isFloat().withMessage('minDecibeles debe ser número'),
  query('maxDecibeles').optional().isFloat().withMessage('maxDecibeles debe ser número'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Límite debe ser entre 1 y 1000'),
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser mayor a 0')
], sensorController.getDatos);

// Obtiene un registro específico por ID
router.get('/datos/:id', [
  param('id').isMongoId().withMessage('ID de MongoDB inválido')
], sensorController.getDatoById);

// Obtiene las últimas N mediciones
router.get('/ultimas', [
  query('cantidad').optional().isInt({ min: 1 }).withMessage('Cantidad debe ser mayor a 0')
], sensorController.getUltimas);

// Obtiene el rango de fechas disponible
router.get('/rango-fechas', sensorController.getRangoFechas);

// Búsqueda avanzada
router.get('/buscar', [
  query('texto').optional().isString(),
  query('fechaInicio').optional().isISO8601(),
  query('fechaFin').optional().isISO8601(),
  query('minDecibeles').optional().isFloat(),
  query('maxDecibeles').optional().isFloat(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 })
], sensorController.buscarAvanzado);

// Exporta a CSV
router.get('/exportar/csv', [
  query('fechaInicio').optional().isISO8601(),
  query('fechaFin').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1 })
], sensorController.exportarCSV);

// Estadísticas por hora
router.get('/estadisticas/hora', [
  query('fecha').optional().isISO8601()
], sensorController.estadisticasHora);

// Estadísticas por día
router.get('/estadisticas/dia', [
  query('dias').optional().isInt({ min: 1 })
], sensorController.estadisticasDia);

// Obtiene alertas
router.get('/alertas', [
  query('umbralBajo').optional().isFloat({ min: 0 }),
  query('umbralAlto').optional().isFloat({ min: 0 }),
  query('limit').optional().isInt({ min: 1 })
], sensorController.getAlertas);

module.exports = router;
