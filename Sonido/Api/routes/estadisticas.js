const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor');
const { query, validationResult } = require('express-validator');

// Resumen general de todas las mediciones
router.get('/resumen', async (req, res) => {
  try {
    // Agrupa todos los documentos y calcula estadísticas globales
    const stats = await Sensor.aggregate([
      {
        $project: {
          time: 1,
          'measurements.LAeq': 1,
          'measurements.battery': 1
        }
      },
      {
        $group: {
          _id: null,
          totalMediciones: { $sum: 1 },
          promedioLAeq: { $avg: '$measurements.LAeq' },
          maxLAeq: { $max: '$measurements.LAeq' },
          minLAeq: { $min: '$measurements.LAeq' },
          desv: { $stdDevPop: '$measurements.LAeq' },
          bateriaProm: { $avg: '$measurements.battery' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {},
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /resumen:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener resumen de datos'
    });
  }
});

// Datos agregados por hora del día con filtro opcional de fecha
router.get('/por-hora', [
  query('fecha').optional().isISO8601().withMessage('Fecha debe ser formato ISO8601')
], async (req, res) => {
  // Valida los parámetros de entrada
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { fecha } = req.query;
    const filtro = {};

    // Si se proporciona fecha, filtra por ese día completo
    if (fecha) {
      const d = new Date(fecha);
      filtro.time = {
        $gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        $lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      };
    }

    // Agrupa las mediciones por hora y calcula estadísticas
    const data = await Sensor.aggregate([
      { $match: filtro },
      {
        $project: {
          hora: { $hour: '$time' },
          'measurements.LAeq': 1
        }
      },
      {
        $group: {
          _id: '$hora',
          promedioLAeq: { $avg: '$measurements.LAeq' },
          maxLAeq: { $max: '$measurements.LAeq' },
          minLAeq: { $min: '$measurements.LAeq' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /por-hora:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos por hora'
    });
  }
});

// Comparación de estadísticas entre días con rango configurable
router.get('/comparacion-dias', [
  query('dias').optional().isInt({ min: 1, max: 90 }).withMessage('Días debe ser entre 1 y 90')
], async (req, res) => {
  // Valida los parámetros de entrada
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    // Limita el rango máximo a 90 días para evitar consultas costosas
    const { dias = 7 } = req.query;
    const diasInt = Math.min(parseInt(dias), 90);
    
    // Calcula la fecha de inicio del rango
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    // Agrupa por día y calcula estadísticas diarias
    const data = await Sensor.aggregate([
      {
        $match: {
          time: { $gte: fechaInicio }
        }
      },
      {
        $project: {
          fecha: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
          'measurements.LAeq': 1
        }
      },
      {
        $group: {
          _id: '$fecha',
          promedioLAeq: { $avg: '$measurements.LAeq' },
          maxLAeq: { $max: '$measurements.LAeq' },
          minLAeq: { $min: '$measurements.LAeq' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data,
      rango_dias: diasInt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /comparacion-dias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al comparar días'
    });
  }
});

module.exports = router;
