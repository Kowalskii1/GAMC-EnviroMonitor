const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor');

// Resumen general
router.get('/resumen', async (req, res) => {
  try {
    const stats = await Sensor.aggregate([
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Datos por hora del día
router.get('/por-hora', async (req, res) => {
  try {
    const { fecha } = req.query;
    const filtro = {};

    if (fecha) {
      const d = new Date(fecha);
      filtro.time = {
        $gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        $lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      };
    }

    const data = await Sensor.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: { $hour: '$time' },
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Comparación entre días
router.get('/comparacion-dias', async (req, res) => {
  try {
    const { dias = 7 } = req.query;
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - parseInt(dias));

    const data = await Sensor.aggregate([
      {
        $match: {
          time: { $gte: fechaInicio }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
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
      rango_dias: parseInt(dias),
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
