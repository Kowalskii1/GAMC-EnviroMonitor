const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

// Obtener todos los datos con filtros
router.get('/datos', sensorController.getDatos);

// Obtener por ID
router.get('/datos/:id', sensorController.getDatoById);

// Obtener últimas N mediciones
router.get('/ultimas', sensorController.getUltimas);

// Obtener rango de fechas
router.get('/rango-fechas', sensorController.getRangoFechas);

// Búsqueda avanzada
router.post('/buscar', sensorController.buscarAvanzado);

// Exportar a CSV
router.get('/exportar/csv', sensorController.exportarCSV);

// Estadísticas por hora
router.get('/estadisticas/hora', sensorController.estadisticasHora);

// Estadísticas por día
router.get('/estadisticas/dia', sensorController.estadisticasDia);

// Alertas (valores fuera de rango)
router.get('/alertas', sensorController.getAlertas);

module.exports = router;
