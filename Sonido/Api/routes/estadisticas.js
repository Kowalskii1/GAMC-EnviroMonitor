const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor');
const { query, validationResult } = require('express-validator');

// ========== UTILIDADES DE CONVERSIÓN ==========

/**
 * Convierte un valor a número de forma segura
 * Maneja strings, null, undefined y valores inválidos
 */
function toNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }
    return null;
}

/**
 * Pipeline de conversión MongoDB - convierte strings a números
 * Utiliza $toDouble para conversión segura en agregaciones
 */
function convertToDoubleStage(field) {
    return { $toDouble: { $ifNull: [field, 0] } };
}

/**
 * Manejo de errores centralizado
 */
function handleError(res, error, context) {
    console.error(`❌ Error en ${context}:`, error);
    res.status(500).json({
        success: false,
        error: `Error al ${context}`,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
    });
}

/**
 * 🔥 CORRECCIÓN: Obtener rango de fechas real de los datos almacenados
 * Detecta automáticamente si son datos históricos o actuales
 */
async function getRealDateRange() {
    try {
        const result = await Sensor.aggregate([
            {
                $group: {
                    _id: null,
                    minDate: { $min: '$time' },
                    maxDate: { $max: '$time' }
                }
            }
        ]);
        
        if (result.length > 0 && result[0].minDate && result[0].maxDate) {
            // 🔥 IMPORTANTE: Asegurarse de que sean objetos Date válidos
            const minDate = new Date(result[0].minDate);
            const maxDate = new Date(result[0].maxDate);
            
            console.log(`📅 Rango de datos detectado: ${minDate.toISOString().split('T')[0]} a ${maxDate.toISOString().split('T')[0]}`);
            
            return {
                minDate,
                maxDate
            };
        }
        
        // Fallback: usar fechas reales de Nov 2024 si no se detecta nada
        console.warn('⚠️  No se detectó rango, usando Nov 2024 como fallback');
        return {
            minDate: new Date('2024-11-01T00:00:00Z'),
            maxDate: new Date('2024-11-30T23:59:59Z')
        };
    } catch (error) {
        console.error('⚠️  Error obteniendo rango de fechas:', error);
        // Fallback seguro a Nov 2024
        return {
            minDate: new Date('2024-11-01T00:00:00Z'),
            maxDate: new Date('2024-11-30T23:59:59Z')
        };
    }
}

// ===================== ANÁLISIS BÁSICO =====================

/**
 * GET /resumen
 * Resumen general con percentiles y estadísticas completas
 * Incluye conversión robusta de tipos y manejo de valores nulos
 */
router.get('/resumen', async (req, res) => {
    try {
        const stats = await Sensor.aggregate([
            {
                $project: {
                    time: 1,
                    LAeq: convertToDoubleStage('$object.LAeq'),
                    LAI: convertToDoubleStage('$object.LAI'),
                    LAImax: convertToDoubleStage('$object.LAImax'),
                    battery: convertToDoubleStage('$object.battery')
                }
            },
            {
                $group: {
                    _id: null,
                    totalMediciones: { $sum: 1 },
                    promedioLAeq: { $avg: '$LAeq' },
                    maxLAeq: { $max: '$LAeq' },
                    minLAeq: { $min: '$LAeq' },
                    desvLAeq: { $stdDevPop: '$LAeq' },
                    promedioLAI: { $avg: '$LAI' },
                    maxLAI: { $max: '$LAI' },
                    minLAI: { $min: '$LAI' },
                    promedioLAImax: { $avg: '$LAImax' },
                    maxLAImax: { $max: '$LAImax' },
                    minLAImax: { $min: '$LAImax' },
                    bateriaProm: { $avg: '$battery' },
                    bateriaMin: { $min: '$battery' },
                    bateriaMax: { $max: '$battery' }
                }
            }
        ]);

        const percentiles = await Sensor.aggregate([
            { 
                $project: { 
                    LAeq: convertToDoubleStage('$object.LAeq')
                } 
            },
            { $match: { LAeq: { $gt: 0 } } },
            { $sort: { LAeq: 1 } },
            {
                $group: {
                    _id: null,
                    valores: { $push: '$LAeq' }
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

        const dateRange = await getRealDateRange();

        res.json({
            success: true,
            data: {
                ...stats[0],
                percentiles: percentiles[0] || {}
            },
            rangoFechas: {
                inicio: dateRange.minDate,
                fin: dateRange.maxDate
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'obtener resumen de datos');
    }
});

// ===================== ANÁLISIS TEMPORAL =====================

/**
 * GET /por-hora
 * Estadísticas por hora del día con datos históricos automáticos
 */
router.get('/por-hora', [
    query('fecha').optional().isISO8601().withMessage('Fecha debe ser formato ISO8601'),
    query('devAddr').optional().isString(),
    query('dias').optional().isInt({ min: 1, max: 90 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const { fecha, devAddr, dias = 7 } = req.query;
        const filtro = {};

        if (fecha) {
            const d = new Date(fecha);
            filtro.time = {
                $gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
                $lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
            };
        } else {
            // 🔥 USAR EL RANGO REAL DETECTADO
            const dateRange = await getRealDateRange();
            const endDate = new Date(dateRange.maxDate);
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - parseInt(dias));
            
            filtro.time = { $gte: startDate, $lte: endDate };
            
            console.log(`📊 Por-hora filtro: ${startDate.toISOString()} a ${endDate.toISOString()}`);
        }

        if (devAddr) filtro.devAddr = devAddr;

        const data = await Sensor.aggregate([
            { $match: filtro },
            {
                $project: {
                    hora: { $hour: '$time' },
                    LAeq: convertToDoubleStage('$object.LAeq'),
                    LAI: convertToDoubleStage('$object.LAI'),
                    LAImax: convertToDoubleStage('$object.LAImax')
                }
            },
            { $match: { LAeq: { $gt: 0 } } },
            {
                $group: {
                    _id: '$hora',
                    promedioLAeq: { $avg: '$LAeq' },
                    maxLAeq: { $max: '$LAeq' },
                    minLAeq: { $min: '$LAeq' },
                    desvLAeq: { $stdDevPop: '$LAeq' },
                    promedioLAI: { $avg: '$LAI' },
                    promedioLAImax: { $avg: '$LAImax' },
                    cantidad: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        console.log(`✅ Por-hora retornó ${data.length} registros`);

        res.json({
            success: true,
            data,
            filtros: { 
                fecha: fecha || `últimos ${dias} días del rango histórico`, 
                devAddr: devAddr || 'todos'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'obtener datos por hora');
    }
});

/**
 * GET /comparacion-dias
 * Comparación de estadísticas entre días con datos históricos
 */
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
        
        // 🔥 USAR EL RANGO REAL DE FECHAS
        const dateRange = await getRealDateRange();
        const fechaFin = new Date(dateRange.maxDate);
        const fechaInicio = new Date(fechaFin);
        fechaInicio.setDate(fechaInicio.getDate() - diasInt);

        const filtro = { time: { $gte: fechaInicio, $lte: fechaFin } };
        if (devAddr) filtro.devAddr = devAddr;

        console.log(`📊 Comparacion-dias filtro: ${fechaInicio.toISOString()} a ${fechaFin.toISOString()}`);

        const data = await Sensor.aggregate([
            { $match: filtro },
            {
                $project: {
                    fecha: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
                    diaSemana: { $dayOfWeek: '$time' },
                    LAeq: convertToDoubleStage('$object.LAeq'),
                    LAI: convertToDoubleStage('$object.LAI'),
                    LAImax: convertToDoubleStage('$object.LAImax')
                }
            },
            { $match: { LAeq: { $gt: 0 } } },
            {
                $group: {
                    _id: { fecha: '$fecha', diaSemana: '$diaSemana' },
                    promedioLAeq: { $avg: '$LAeq' },
                    maxLAeq: { $max: '$LAeq' },
                    minLAeq: { $min: '$LAeq' },
                    desvLAeq: { $stdDevPop: '$LAeq' },
                    promedioLAI: { $avg: '$LAI' },
                    promedioLAImax: { $avg: '$LAImax' },
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

        console.log(`✅ Comparacion-dias retornó ${data.length} registros`);

        res.json({
            success: true,
            data,
            rango_dias: diasInt,
            rangoFechas: {
                inicio: fechaInicio,
                fin: fechaFin
            },
            filtros: { devAddr: devAddr || 'todos' },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'comparar días');
    }
});

// ===================== ANÁLISIS AVANZADO =====================

/**
 * GET /por-dia-semana
 * Análisis de patrones por día de la semana con datos históricos
 */
router.get('/por-dia-semana', [
    query('dias').optional().isInt({ min: 7, max: 90 }),
    query('devAddr').optional().isString()
], async (req, res) => {
    try {
        const { dias = 30, devAddr } = req.query;
        const diasInt = Math.min(parseInt(dias), 90);
        
        const dateRange = await getRealDateRange();
        const fechaFin = new Date(dateRange.maxDate);
        const fechaInicio = new Date(fechaFin);
        fechaInicio.setDate(fechaInicio.getDate() - diasInt);

        const filtro = { time: { $gte: fechaInicio, $lte: fechaFin } };
        if (devAddr) filtro.devAddr = devAddr;

        const data = await Sensor.aggregate([
            { $match: filtro },
            {
                $project: {
                    diaSemana: { $dayOfWeek: '$time' },
                    LAeq: convertToDoubleStage('$object.LAeq'),
                    LAI: convertToDoubleStage('$object.LAI')
                }
            },
            { $match: { LAeq: { $gt: 0 } } },
            {
                $group: {
                    _id: '$diaSemana',
                    promedioLAeq: { $avg: '$LAeq' },
                    maxLAeq: { $max: '$LAeq' },
                    minLAeq: { $min: '$LAeq' },
                    desvLAeq: { $stdDevPop: '$LAeq' },
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
            rangoFechas: {
                inicio: fechaInicio,
                fin: fechaFin
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'analizar por día de semana');
    }
});

/**
 * GET /tendencias
 * Análisis de tendencias con regresión lineal simple
 */
router.get('/tendencias', [
    query('dias').optional().isInt({ min: 7, max: 90 }),
    query('devAddr').optional().isString()
], async (req, res) => {
    try {
        const { dias = 30, devAddr } = req.query;
        const diasInt = Math.min(parseInt(dias), 90);
        
        const dateRange = await getRealDateRange();
        const fechaFin = new Date(dateRange.maxDate);
        const fechaInicio = new Date(fechaFin);
        fechaInicio.setDate(fechaInicio.getDate() - diasInt);

        const filtro = { time: { $gte: fechaInicio, $lte: fechaFin } };
        if (devAddr) filtro.devAddr = devAddr;

        const data = await Sensor.aggregate([
            { $match: filtro },
            {
                $project: {
                    fecha: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
                    LAeq: convertToDoubleStage('$object.LAeq')
                }
            },
            { $match: { LAeq: { $gt: 0 } } },
            {
                $group: {
                    _id: '$fecha',
                    promedioLAeq: { $avg: '$LAeq' },
                    maxLAeq: { $max: '$LAeq' },
                    cantidad: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Calcular regresión lineal
        let n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        data.forEach((item, index) => {
            const y = toNumber(item.promedioLAeq) || 0;
            sumX += index;
            sumY += y;
            sumXY += index * y;
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
            rangoFechas: {
                inicio: fechaInicio,
                fin: fechaFin
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'calcular tendencias');
    }
});

// ===================== ANÁLISIS POR DISPOSITIVO =====================

/**
 * GET /comparacion-dispositivos
 * Comparación de rendimiento entre todos los dispositivos
 */
router.get('/comparacion-dispositivos', [
    query('dias').optional().isInt({ min: 1, max: 90 })
], async (req, res) => {
    try {
        const { dias = 7 } = req.query;
        const diasInt = Math.min(parseInt(dias), 90);
        
        const dateRange = await getRealDateRange();
        const fechaFin = new Date(dateRange.maxDate);
        const fechaInicio = new Date(fechaFin);
        fechaInicio.setDate(fechaInicio.getDate() - diasInt);

        const data = await Sensor.aggregate([
            { $match: { time: { $gte: fechaInicio, $lte: fechaFin } } },
            {
                $project: {
                    devAddr: 1,
                    deviceName: '$deviceInfo.deviceName',
                    LAeq: convertToDoubleStage('$object.LAeq'),
                    LAI: convertToDoubleStage('$object.LAI'),
                    battery: convertToDoubleStage('$object.battery'),
                    time: 1
                }
            },
            { $match: { LAeq: { $gt: 0 } } },
            {
                $group: {
                    _id: '$devAddr',
                    deviceName: { $first: '$deviceName' },
                    promedioLAeq: { $avg: '$LAeq' },
                    maxLAeq: { $max: '$LAeq' },
                    minLAeq: { $min: '$LAeq' },
                    desvLAeq: { $stdDevPop: '$LAeq' },
                    promedioLAI: { $avg: '$LAI' },
                    promedioBateria: { $avg: '$battery' },
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
            rangoFechas: {
                inicio: fechaInicio,
                fin: fechaFin
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'comparar dispositivos');
    }
});

/**
 * GET /dispositivos-ranking
 * Top 10 dispositivos ordenados por métrica específica
 */
router.get('/dispositivos-ranking', [
    query('dias').optional().isInt({ min: 1, max: 90 }),
    query('metrica').optional().isIn(['promedio', 'maximo', 'variabilidad'])
], async (req, res) => {
    try {
        const { dias = 7, metrica = 'promedio' } = req.query;
        const diasInt = Math.min(parseInt(dias), 90);
        
        const dateRange = await getRealDateRange();
        const fechaFin = new Date(dateRange.maxDate);
        const fechaInicio = new Date(fechaFin);
        fechaInicio.setDate(fechaInicio.getDate() - diasInt);

        const sortField = metrica === 'maximo' ? 'maxLAeq' : 
                          metrica === 'variabilidad' ? 'desvLAeq' : 
                          'promedioLAeq';

        const data = await Sensor.aggregate([
            { $match: { time: { $gte: fechaInicio, $lte: fechaFin } } },
            {
                $project: {
                    devAddr: 1,
                    deviceName: '$deviceInfo.deviceName',
                    LAeq: convertToDoubleStage('$object.LAeq')
                }
            },
            { $match: { LAeq: { $gt: 0 } } },
            {
                $group: {
                    _id: '$devAddr',
                    deviceName: { $first: '$deviceName' },
                    promedioLAeq: { $avg: '$LAeq' },
                    maxLAeq: { $max: '$LAeq' },
                    minLAeq: { $min: '$LAeq' },
                    desvLAeq: { $stdDevPop: '$LAeq' },
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
        handleError(res, error, 'generar ranking de dispositivos');
    }
});

// ===================== ANÁLISIS DE CUMPLIMIENTO NORMATIVO =====================

/**
 * GET /cumplimiento-normativo
 * Análisis de cumplimiento de umbrales regulatorios día/noche
 */
router.get('/cumplimiento-normativo', [
    query('dias').optional().isInt({ min: 1, max: 90 }),
    query('umbralDia').optional().isFloat({ min: 0, max: 120 }),
    query('umbralNoche').optional().isFloat({ min: 0, max: 120 }),
    query('devAddr').optional().isString()
], async (req, res) => {
    try {
        const { dias = 7, umbralDia = 70, umbralNoche = 60, devAddr } = req.query;
        const diasInt = Math.min(parseInt(dias), 90);
        
        const dateRange = await getRealDateRange();
        const fechaFin = new Date(dateRange.maxDate);
        const fechaInicio = new Date(fechaFin);
        fechaInicio.setDate(fechaInicio.getDate() - diasInt);

        const filtro = { time: { $gte: fechaInicio, $lte: fechaFin } };
        if (devAddr) filtro.devAddr = devAddr;

        const data = await Sensor.aggregate([
            { $match: filtro },
            {
                $project: {
                    hora: { $hour: '$time' },
                    fecha: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
                    laeq: convertToDoubleStage('$object.LAeq'),
                    devAddr: 1
                }
            },
            { $match: { laeq: { $gt: 0 } } },
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
            totalPeriodos: data.length,
            periodosConCumplimiento: data.filter(d => d.cumple).length,
            porcentajeCumplimientoGlobal: data.length > 0 
                ? (data.filter(d => d.cumple).length / data.length * 100).toFixed(2)
                : '0.00'
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
        handleError(res, error, 'analizar cumplimiento normativo');
    }
});

// ===================== ANÁLISIS DE PATRONES =====================

/**
 * GET /picos-ruido
 * Detección automática de picos de ruido con umbral dinámico
 */
router.get('/picos-ruido', [
    query('dias').optional().isInt({ min: 1, max: 30 }),
    query('umbral').optional().isFloat({ min: 0 }),
    query('devAddr').optional().isString()
], async (req, res) => {
    try {
        const { dias = 7, umbral, devAddr } = req.query;
        const diasInt = Math.min(parseInt(dias), 30);
        
        const dateRange = await getRealDateRange();
        const fechaFin = new Date(dateRange.maxDate);
        const fechaInicio = new Date(fechaFin);
        fechaInicio.setDate(fechaInicio.getDate() - diasInt);

        const filtro = { time: { $gte: fechaInicio, $lte: fechaFin } };
        if (devAddr) filtro.devAddr = devAddr;

        // Calcular umbral dinámico si no se proporciona
        let umbralFinal = umbral;
        if (!umbral) {
            const stats = await Sensor.aggregate([
                { $match: filtro },
                {
                    $project: {
                        LAeq: convertToDoubleStage('$object.LAeq')
                    }
                },
                { $match: { LAeq: { $gt: 0 } } },
                {
                    $group: {
                        _id: null,
                        promedio: { $avg: '$LAeq' },
                        desv: { $stdDevPop: '$LAeq' }
                    }
                }
            ]);
            umbralFinal = stats[0] ? stats[0].promedio + (2 * stats[0].desv) : 80;
        }

        const umbralNum = parseFloat(umbralFinal);

        // Obtener picos
        const picos = await Sensor.aggregate([
            { $match: filtro },
            {
                $project: {
                    time: 1,
                    devAddr: 1,
                    deviceName: '$deviceInfo.deviceName',
                    LAeq: convertToDoubleStage('$object.LAeq'),
                    LAI: convertToDoubleStage('$object.LAI'),
                    LAImax: convertToDoubleStage('$object.LAImax')
                }
            },
            { $match: { LAeq: { $gte: umbralNum } } },
            { $sort: { LAeq: -1 } },
            { $limit: 100 }
        ]);

        // Agrupar por hora
        const picosPorHora = await Sensor.aggregate([
            { $match: filtro },
            {
                $project: {
                    hora: { $hour: '$time' },
                    LAeq: convertToDoubleStage('$object.LAeq')
                }
            },
            { $match: { LAeq: { $gte: umbralNum } } },
            {
                $group: {
                    _id: '$hora',
                    cantidad: { $sum: 1 },
                    promedioLAeq: { $avg: '$LAeq' },
                    maxLAeq: { $max: '$LAeq' }
                }
            },
            { $sort: { cantidad: -1 } }
        ]);

        res.json({
            success: true,
            picos,
            picosPorHora,
            umbral: umbralNum,
            totalPicos: picos.length,
            periodo: `Últimos ${diasInt} días`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'detectar picos de ruido');
    }
});

// ===================== ANÁLISIS DE BATERÍA =====================

/**
 * GET /estado-baterias
 * Estado actual y proyecciones de batería para todos los dispositivos
 */
router.get('/estado-baterias', async (req, res) => {
    try {
        const data = await Sensor.aggregate([
            { $sort: { devAddr: 1, time: -1 } },
            {
                $group: {
                    _id: '$devAddr',
                    deviceName: { $first: '$deviceInfo.deviceName' },
                    ultimaBateria: { $first: { $toDouble: { $ifNull: ['$object.battery', 0] } } },
                    promedioBateria: { $avg: { $toDouble: { $ifNull: ['$object.battery', 0] } } },
                    minBateria: { $min: { $toDouble: { $ifNull: ['$object.battery', 0] } } },
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
        handleError(res, error, 'analizar estado de baterías');
    }
});

/**
 * GET /historial-bateria/:devAddr
 * Historial de batería con proyección de vida útil
 */
router.get('/historial-bateria/:devAddr', [
    query('dias').optional().isInt({ min: 1, max: 90 })
], async (req, res) => {
    try {
        const { devAddr } = req.params;
        const { dias = 30 } = req.query;
        const diasInt = Math.min(parseInt(dias), 90);
        
        const dateRange = await getRealDateRange();
        const fechaFin = new Date(dateRange.maxDate);
        const fechaInicio = new Date(fechaFin);
        fechaInicio.setDate(fechaInicio.getDate() - diasInt);

        const data = await Sensor.aggregate([
            {
                $match: {
                    devAddr,
                    time: { $gte: fechaInicio, $lte: fechaFin }
                }
            },
            {
                $project: {
                    fecha: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
                    battery: convertToDoubleStage('$object.battery')
                }
            },
            { $match: { battery: { $gt: 0 } } },
            {
                $group: {
                    _id: '$fecha',
                    bateriaProm: { $avg: '$battery' },
                    bateriaMin: { $min: '$battery' },
                    bateriaMax: { $max: '$battery' },
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
        let analisis = null;
        if (data.length >= 2) {
            const primerDia = toNumber(data[0].bateriaProm) || 0;
            const ultimoDia = toNumber(data[data.length - 1].bateriaProm) || 0;
            const diasTranscurridos = data.length;
            const tasaDescarga = (primerDia - ultimoDia) / diasTranscurridos;

            const diasRestantes = tasaDescarga > 0 ? Math.floor(ultimoDia / tasaDescarga) : null;

            analisis = {
                bateriaInicial: primerDia.toFixed(2),
                bateriaActual: ultimoDia.toFixed(2),
                tasaDescargaDiaria: tasaDescarga.toFixed(2),
                diasRestantesEstimados: diasRestantes,
                recomendacion: diasRestantes && diasRestantes < 14 ? 
                    'Considerar reemplazo o recarga pronto' : 'Batería en buen estado'
            };
        }

        res.json({
            success: true,
            data,
            analisis: analisis || { mensaje: 'Datos insuficientes para análisis de tendencia' },
            periodo: `Últimos ${diasInt} días`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        handleError(res, error, 'obtener historial de batería');
    }
});

module.exports = router;
