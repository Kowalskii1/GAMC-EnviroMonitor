const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor');
const { query, validationResult } = require('express-validator');

// ===================== ANÁLISIS BÁSICO =====================

// Resumen general con percentiles
router.get('/resumen', async (req, res) => {
  try {
    const stats = await Sensor.aggregate([
      {
        $project: {
          time: 1,
          'object.LAeq': 1,
          'object.LAI': 1,
          'object.LAImax': 1,
          'object.battery': 1
        }
      },
      {
        $group: {
          _id: null,
          totalMediciones: { $sum: 1 },
          // LAeq
          promedioLAeq: { $avg: '$object.LAeq' },
          maxLAeq: { $max: '$object.LAeq' },
          minLAeq: { $min: '$object.LAeq' },
          desvLAeq: { $stdDevPop: '$object.LAeq' },
          // LAI
          promedioLAI: { $avg: '$object.LAI' },
          maxLAI: { $max: '$object.LAI' },
          minLAI: { $min: '$object.LAI' },
          // LAImax
          promedioLAImax: { $avg: '$object.LAImax' },
          maxLAImax: { $max: '$object.LAImax' },
          minLAImax: { $min: '$object.LAImax' },
          // Batería
          bateriaProm: { $avg: '$object.battery' },
          bateriaMin: { $min: '$object.battery' },
          bateriaMax: { $max: '$object.battery' }
        }
      }
    ]);

    // Calcular percentiles
    const percentiles = await Sensor.aggregate([
      { $match: { 'object.LAeq': { $exists: true, $ne: null } } },
      { $sort: { 'object.LAeq': 1 } },
      {
        $group: {
          _id: null,
          valores: { $push: '$object.LAeq' }
        }
      },
      {
        $project: {
          p10: { $arrayElemAt: ['$valores', { $floor: { $multiply: [{ $size: '$valores' }, 0.10] } }] },
          p25: { $arrayElemAt: ['$valores', { $floor: { $multiply: [{ $size: '$valores' }, 0.25] } }] },
          p50: { $arrayElemAt: ['$valores', { $floor: { $multiply: [{ $size: '$valores' }, 0.50] } }] },
          p75: { $arrayElemAt: ['$valores', { $floor: { $multiply: [{ $size: '$valores' }, 0.75] } }] },
          p90: { $arrayElemAt: ['$valores', { $floor: { $multiply: [{ $size: '$valores' }, 0.90] } }] },
          p95: { $arrayElemAt: ['$valores', { $floor: { $multiply: [{ $size: '$valores' }, 0.95] } }] },
          p99: { $arrayElemAt: ['$valores', { $floor: { $multiply: [{ $size: '$valores' }, 0.99] } }] }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        ...stats[0],
        percentiles: percentiles[0] || {}
      },
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

// ===================== ANÁLISIS TEMPORAL =====================

// Estadísticas por hora del día
router.get('/por-hora', [
  query('fecha').optional().isISO8601().withMessage('Fecha debe ser formato ISO8601'),
  query('devAddr').optional().isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { fecha, devAddr } = req.query;
    const filtro = {};

    if (fecha) {
      const d = new Date(fecha);
      filtro.time = {
        $gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        $lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      };
    }

    if (devAddr) {
      filtro.devAddr = devAddr;
    }

    const data = await Sensor.aggregate([
      { $match: filtro },
      {
        $project: {
          hora: { $hour: '$time' },
          'object.LAeq': 1,
          'object.LAI': 1,
          'object.LAImax': 1
        }
      },
      {
        $group: {
          _id: '$hora',
          promedioLAeq: { $avg: '$object.LAeq' },
          maxLAeq: { $max: '$object.LAeq' },
          minLAeq: { $min: '$object.LAeq' },
          desvLAeq: { $stdDevPop: '$object.LAeq' },
          promedioLAI: { $avg: '$object.LAI' },
          promedioLAImax: { $avg: '$object.LAImax' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data,
      filtros: { fecha: fecha || 'todas', devAddr: devAddr || 'todos' },
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

// Comparación de estadísticas entre días
router.get('/comparacion-dias', [
  query('dias').optional().isInt({ min: 1, max: 90 }).withMessage('Días debe ser entre 1 y 90'),
  query('devAddr').optional().isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { dias = 7, devAddr } = req.query;
    const diasInt = Math.min(parseInt(dias), 90);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    const filtro = { time: { $gte: fechaInicio } };
    if (devAddr) filtro.devAddr = devAddr;

    const data = await Sensor.aggregate([
      { $match: filtro },
      {
        $project: {
          fecha: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
          diaSemana: { $dayOfWeek: '$time' },
          'object.LAeq': 1,
          'object.LAI': 1,
          'object.LAImax': 1
        }
      },
      {
        $group: {
          _id: { fecha: '$fecha', diaSemana: '$diaSemana' },
          promedioLAeq: { $avg: '$object.LAeq' },
          maxLAeq: { $max: '$object.LAeq' },
          minLAeq: { $min: '$object.LAeq' },
          desvLAeq: { $stdDevPop: '$object.LAeq' },
          promedioLAI: { $avg: '$object.LAI' },
          promedioLAImax: { $avg: '$object.LAImax' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { '_id.fecha': 1 } },
      {
        $project: {
          fecha: '$_id.fecha',
          diaSemana: '$_id.diaSemana',
          promedioLAeq: 1,
          maxLAeq: 1,
          minLAeq: 1,
          desvLAeq: 1,
          promedioLAI: 1,
          promedioLAImax: 1,
          cantidad: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      success: true,
      data,
      rango_dias: diasInt,
      filtros: { devAddr: devAddr || 'todos' },
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

// ===================== ANÁLISIS AVANZADO =====================

// Análisis por día de la semana
router.get('/por-dia-semana', [
  query('dias').optional().isInt({ min: 7, max: 90 }),
  query('devAddr').optional().isString()
], async (req, res) => {
  try {
    const { dias = 30, devAddr } = req.query;
    const diasInt = Math.min(parseInt(dias), 90);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    const filtro = { time: { $gte: fechaInicio } };
    if (devAddr) filtro.devAddr = devAddr;

    const data = await Sensor.aggregate([
      { $match: filtro },
      {
        $project: {
          diaSemana: { $dayOfWeek: '$time' },
          'object.LAeq': 1,
          'object.LAI': 1
        }
      },
      {
        $group: {
          _id: '$diaSemana',
          promedioLAeq: { $avg: '$object.LAeq' },
          maxLAeq: { $max: '$object.LAeq' },
          minLAeq: { $min: '$object.LAeq' },
          desvLAeq: { $stdDevPop: '$object.LAeq' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          diaSemana: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 1] }, then: 'Domingo' },
                { case: { $eq: ['$_id', 2] }, then: 'Lunes' },
                { case: { $eq: ['$_id', 3] }, then: 'Martes' },
                { case: { $eq: ['$_id', 4] }, then: 'Miércoles' },
                { case: { $eq: ['$_id', 5] }, then: 'Jueves' },
                { case: { $eq: ['$_id', 6] }, then: 'Viernes' },
                { case: { $eq: ['$_id', 7] }, then: 'Sábado' }
              ],
              default: 'Desconocido'
            }
          },
          promedioLAeq: 1,
          maxLAeq: 1,
          minLAeq: 1,
          desvLAeq: 1,
          cantidad: 1,
          _id: 0
        }
      }
    ]);

    res.json({
      success: true,
      data,
      periodo: `Últimos ${diasInt} días`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /por-dia-semana:', error);
    res.status(500).json({
      success: false,
      error: 'Error al analizar por día de semana'
    });
  }
});

// Análisis de tendencias (regresión lineal simple)
router.get('/tendencias', [
  query('dias').optional().isInt({ min: 7, max: 90 }),
  query('devAddr').optional().isString()
], async (req, res) => {
  try {
    const { dias = 30, devAddr } = req.query;
    const diasInt = Math.min(parseInt(dias), 90);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    const filtro = { time: { $gte: fechaInicio } };
    if (devAddr) filtro.devAddr = devAddr;

    const data = await Sensor.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
          promedioLAeq: { $avg: '$object.LAeq' },
          maxLAeq: { $max: '$object.LAeq' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Calcular tendencia (regresión lineal simple)
    let n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    data.forEach((item, index) => {
      sumX += index;
      sumY += item.promedioLAeq || 0;
      sumXY += index * (item.promedioLAeq || 0);
      sumX2 += index * index;
    });

    const pendiente = n > 0 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
    const intercepto = n > 0 ? (sumY - pendiente * sumX) / n : 0;

    const tendencia = pendiente > 0.1 ? 'Creciente' : 
                      pendiente < -0.1 ? 'Decreciente' : 'Estable';

    res.json({
      success: true,
      data,
      analisis: {
        tendencia,
        pendiente: pendiente.toFixed(4),
        intercepto: intercepto.toFixed(2),
        interpretacion: `El ruido promedio ${
          pendiente > 0 ? 'aumenta' : pendiente < 0 ? 'disminuye' : 'se mantiene estable'
        } aproximadamente ${Math.abs(pendiente).toFixed(2)} dB por día`
      },
      periodo: `Últimos ${diasInt} días`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /tendencias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al calcular tendencias'
    });
  }
});

// ===================== ANÁLISIS POR DISPOSITIVO =====================

// Comparación entre dispositivos
router.get('/comparacion-dispositivos', [
  query('dias').optional().isInt({ min: 1, max: 90 })
], async (req, res) => {
  try {
    const { dias = 7 } = req.query;
    const diasInt = Math.min(parseInt(dias), 90);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    const data = await Sensor.aggregate([
      { $match: { time: { $gte: fechaInicio } } },
      {
        $group: {
          _id: '$devAddr',
          deviceName: { $first: '$deviceInfo.deviceName' },
          promedioLAeq: { $avg: '$object.LAeq' },
          maxLAeq: { $max: '$object.LAeq' },
          minLAeq: { $min: '$object.LAeq' },
          desvLAeq: { $stdDevPop: '$object.LAeq' },
          promedioLAI: { $avg: '$object.LAI' },
          promedioBateria: { $avg: '$object.battery' },
          totalMediciones: { $sum: 1 },
          ultimaMedicion: { $max: '$time' }
        }
      },
      { $sort: { promedioLAeq: -1 } }
    ]);

    res.json({
      success: true,
      data,
      total_dispositivos: data.length,
      periodo: `Últimos ${diasInt} días`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /comparacion-dispositivos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al comparar dispositivos'
    });
  }
});

// Ranking de dispositivos más ruidosos
router.get('/dispositivos-ranking', [
  query('dias').optional().isInt({ min: 1, max: 90 }),
  query('metrica').optional().isIn(['promedio', 'maximo', 'variabilidad'])
], async (req, res) => {
  try {
    const { dias = 7, metrica = 'promedio' } = req.query;
    const diasInt = Math.min(parseInt(dias), 90);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    const sortField = metrica === 'maximo' ? 'maxLAeq' : 
                      metrica === 'variabilidad' ? 'desvLAeq' : 
                      'promedioLAeq';

    const data = await Sensor.aggregate([
      { $match: { time: { $gte: fechaInicio } } },
      {
        $group: {
          _id: '$devAddr',
          deviceName: { $first: '$deviceInfo.deviceName' },
          promedioLAeq: { $avg: '$object.LAeq' },
          maxLAeq: { $max: '$object.LAeq' },
          minLAeq: { $min: '$object.LAeq' },
          desvLAeq: { $stdDevPop: '$object.LAeq' },
          totalMediciones: { $sum: 1 }
        }
      },
      { $sort: { [sortField]: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data,
      metrica_ordenamiento: metrica,
      periodo: `Últimos ${diasInt} días`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /dispositivos-ranking:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar ranking de dispositivos'
    });
  }
});

// ===================== ANÁLISIS DE CUMPLIMIENTO NORMATIVO =====================

// Cumplimiento de umbrales según normativa
router.get('/cumplimiento-normativo', [
  query('dias').optional().isInt({ min: 1, max: 90 }),
  query('umbralDia').optional().isFloat({ min: 0, max: 120 }),
  query('umbralNoche').optional().isFloat({ min: 0, max: 120 }),
  query('devAddr').optional().isString()
], async (req, res) => {
  try {
    const { dias = 7, umbralDia = 70, umbralNoche = 60, devAddr } = req.query;
    const diasInt = Math.min(parseInt(dias), 90);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    const filtro = { time: { $gte: fechaInicio } };
    if (devAddr) filtro.devAddr = devAddr;

    const data = await Sensor.aggregate([
      { $match: filtro },
      {
        $project: {
          hora: { $hour: '$time' },
          fecha: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
          laeq: '$object.LAeq',
          devAddr: 1
        }
      },
      {
        $addFields: {
          periodo: {
            $cond: {
              if: { $and: [{ $gte: ['$hora', 7] }, { $lt: ['$hora', 22] }] },
              then: 'dia',
              else: 'noche'
            }
          },
          umbral: {
            $cond: {
              if: { $and: [{ $gte: ['$hora', 7] }, { $lt: ['$hora', 22] }] },
              then: parseFloat(umbralDia),
              else: parseFloat(umbralNoche)
            }
          }
        }
      },
      {
        $addFields: {
          excede: { $gt: ['$laeq', '$umbral'] }
        }
      },
      {
        $group: {
          _id: { fecha: '$fecha', periodo: '$periodo' },
          totalMediciones: { $sum: 1 },
          medicionesExcedidas: { $sum: { $cond: ['$excede', 1, 0] } },
          promedioLAeq: { $avg: '$laeq' },
          maxLAeq: { $max: '$laeq' },
          umbral: { $first: '$umbral' }
        }
      },
      {
        $project: {
          fecha: '$_id.fecha',
          periodo: '$_id.periodo',
          totalMediciones: 1,
          medicionesExcedidas: 1,
          porcentajeIncumplimiento: {
            $multiply: [
              { $divide: ['$medicionesExcedidas', '$totalMediciones'] },
              100
            ]
          },
          promedioLAeq: 1,
          maxLAeq: 1,
          umbral: 1,
          cumple: { $lt: ['$medicionesExcedidas', { $multiply: ['$totalMediciones', 0.1] }] },
          _id: 0
        }
      },
      { $sort: { fecha: 1, periodo: 1 } }
    ]);

    const resumen = {
      totalDias: data.length / 2,
      diasCumplimiento: data.filter(d => d.cumple).length,
      porcentajeCumplimientoGlobal: (data.filter(d => d.cumple).length / data.length * 100).toFixed(2)
    };

    res.json({
      success: true,
      data,
      resumen,
      umbrales: { dia: parseFloat(umbralDia), noche: parseFloat(umbralNoche) },
      criterio: 'Cumple si menos del 10% de mediciones exceden el umbral',
      periodo: `Últimos ${diasInt} días`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /cumplimiento-normativo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al analizar cumplimiento normativo'
    });
  }
});

// ===================== ANÁLISIS DE PATRONES =====================

// Detección de picos de ruido
router.get('/picos-ruido', [
  query('dias').optional().isInt({ min: 1, max: 30 }),
  query('umbral').optional().isFloat({ min: 0 }),
  query('devAddr').optional().isString()
], async (req, res) => {
  try {
    const { dias = 7, umbral, devAddr } = req.query;
    const diasInt = Math.min(parseInt(dias), 30);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    const filtro = { time: { $gte: fechaInicio } };
    if (devAddr) filtro.devAddr = devAddr;

    // Calcular umbral dinámico si no se proporciona
    let umbralFinal = umbral;
    if (!umbral) {
      const stats = await Sensor.aggregate([
        { $match: filtro },
        {
          $group: {
            _id: null,
            promedio: { $avg: '$object.LAeq' },
            desv: { $stdDevPop: '$object.LAeq' }
          }
        }
      ]);
      umbralFinal = stats[0] ? stats[0].promedio + (2 * stats[0].desv) : 80;
    }

    filtro['object.LAeq'] = { $gte: parseFloat(umbralFinal) };

    const picos = await Sensor.find(filtro)
      .select('time devAddr deviceInfo.deviceName object.LAeq object.LAI object.LAImax')
      .sort({ 'object.LAeq': -1 })
      .limit(100)
      .lean();

    // Agrupar por hora para identificar periodos problemáticos
    const picosPorHora = await Sensor.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: { $hour: '$time' },
          cantidad: { $sum: 1 },
          promedioLAeq: { $avg: '$object.LAeq' },
          maxLAeq: { $max: '$object.LAeq' }
        }
      },
      { $sort: { cantidad: -1 } }
    ]);

    res.json({
      success: true,
      picos,
      picosPorHora,
      umbral: parseFloat(umbralFinal),
      totalPicos: picos.length,
      periodo: `Últimos ${diasInt} días`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /picos-ruido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al detectar picos de ruido'
    });
  }
});

// ===================== ANÁLISIS DE BATERÍA =====================

// Estado de baterías de dispositivos
router.get('/estado-baterias', async (req, res) => {
  try {
    const data = await Sensor.aggregate([
      { $sort: { devAddr: 1, time: -1 } },
      {
        $group: {
          _id: '$devAddr',
          deviceName: { $first: '$deviceInfo.deviceName' },
          ultimaBateria: { $first: '$object.battery' },
          promedioBateria: { $avg: '$object.battery' },
          minBateria: { $min: '$object.battery' },
          ultimaMedicion: { $first: '$time' },
          totalMediciones: { $sum: 1 }
        }
      },
      {
        $addFields: {
          estadoBateria: {
            $switch: {
              branches: [
                { case: { $gte: ['$ultimaBateria', 80] }, then: 'Excelente' },
                { case: { $gte: ['$ultimaBateria', 50] }, then: 'Bueno' },
                { case: { $gte: ['$ultimaBateria', 30] }, then: 'Regular' },
                { case: { $gte: ['$ultimaBateria', 20] }, then: 'Bajo' }
              ],
              default: 'Crítico'
            }
          },
          alertaBateria: { $lt: ['$ultimaBateria', 30] }
        }
      },
      { $sort: { ultimaBateria: 1 } }
    ]);

    const resumen = {
      totalDispositivos: data.length,
      dispositivosCriticos: data.filter(d => d.ultimaBateria < 20).length,
      dispositivosBajos: data.filter(d => d.ultimaBateria >= 20 && d.ultimaBateria < 30).length,
      dispositivosNormales: data.filter(d => d.ultimaBateria >= 30).length
    };

    res.json({
      success: true,
      data,
      resumen,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en /estado-baterias:', error);
    res.status(500).json({
      success: false,
      error: 'Error al analizar estado de baterías'
    });
  }
});

// Historial de batería por dispositivo
router.get('/historial-bateria/:devAddr', [
  query('dias').optional().isInt({ min: 1, max: 90 })
], async (req, res) => {
  try {
    const { devAddr } = req.params;
    const { dias = 30 } = req.query;
    const diasInt = Math.min(parseInt(dias), 90);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    const data = await Sensor.aggregate([
      {
        $match: {
          devAddr,
          time: { $gte: fechaInicio },
          'object.battery': { $exists: true }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
          bateriaProm: { $avg: '$object.battery' },
          bateriaMin: { $min: '$object.battery' },
          bateriaMax: { $max: '$object.battery' },
          mediciones: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          fecha: '$_id',
          bateriaProm: 1,
          bateriaMin: 1,
          bateriaMax: 1,
          mediciones: 1,
          _id: 0
        }
      }
    ]);

    // Calcular tasa de descarga
    if (data.length >= 2) {
      const primerDia = data[0].bateriaProm;
      const ultimoDia = data[data.length - 1].bateriaProm;
      const diasTranscurridos = data.length;
      const tasaDescarga = (primerDia - ultimoDia) / diasTranscurridos;

      const diasRestantes = tasaDescarga > 0 ? Math.floor(ultimoDia / tasaDescarga) : null;

      res.json({
        success: true,
        data,
        analisis: {
          bateriaInicial: primerDia.toFixed(2),
          bateriaActual: ultimoDia.toFixed(2),
          tasaDescargaDiaria: tasaDescarga.toFixed(2),
          diasRestantesEstimados: diasRestantes,
          recomendacion: diasRestantes && diasRestantes < 14 ? 
            'Considerar reemplazo o recarga pronto' : 'Batería en buen estado'
        },
        periodo: `Últimos ${diasInt} días`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        data,
        mensaje: 'Datos insuficientes para análisis de tendencia',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error en /historial-bateria:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial de batería'
    });
  }
});

module.exports = router;
