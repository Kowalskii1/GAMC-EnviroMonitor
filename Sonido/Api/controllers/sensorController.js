const Sensor = require('../models/Sensor');
const { validationResult } = require('express-validator');

/**
 * Middleware helper para manejar errores de validación
 * Debe ser llamado al inicio de cada controlador que use validación
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
      timestamp: new Date().toISOString()
    });
  }
  return null;
};

// Obtiene datos con filtros opcionales y paginación
exports.getDatos = async (req, res, next) => {
  try {
    // Valida errores de express-validator
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const {
      fechaInicio,
      fechaFin,
      minDecibeles,
      maxDecibeles,
      page = 1,
      limit = 100,
      sort = '-time'
    } = req.query;

    const filtro = {};

    // Construye filtro de rango de fechas
    if (fechaInicio || fechaFin) {
      filtro.time = {};
      if (fechaInicio) filtro.time.$gte = new Date(fechaInicio);
      if (fechaFin) filtro.time.$lte = new Date(fechaFin);
    }

    // Construye filtro de rango de decibeles
    if (minDecibeles || maxDecibeles) {
      filtro['measurements.LAeq'] = {};
      if (minDecibeles) filtro['measurements.LAeq'].$gte = parseFloat(minDecibeles);
      if (maxDecibeles) filtro['measurements.LAeq'].$lte = parseFloat(maxDecibeles);
    }

    // Calcula skip para paginación
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;

    // Ejecuta consultas en paralelo para mejor performance
    const [datos, total] = await Promise.all([
      Sensor.find(filtro)
        .sort(sort)
        .skip(skip)
        .limit(limitInt)
        .lean(), // Usa lean para mejor performance
      Sensor.countDocuments(filtro)
    ]);

    res.json({
      success: true,
      data: datos,
      pagination: {
        total,
        page: pageInt,
        pages: Math.ceil(total / limitInt),
        limit: limitInt
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Pasa el error al middleware global de errores
    next(error);
  }
};

// Obtiene un documento específico por su ID de MongoDB
exports.getDatoById = async (req, res, next) => {
  try {
    // Valida errores de express-validator
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const dato = await Sensor.findById(req.params.id).lean();
    
    if (!dato) {
      return res.status(404).json({
        success: false,
        error: 'Dato no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: dato,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene las últimas N mediciones ordenadas por fecha descendente
exports.getUltimas = async (req, res, next) => {
  try {
    // Valida errores de express-validator
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { cantidad = 50 } = req.query;
    const cantidadInt = Math.min(parseInt(cantidad), 1000); // Límite máximo de seguridad

    const datos = await Sensor.find()
      .sort({ time: -1 })
      .limit(cantidadInt)
      .lean();

    res.json({
      success: true,
      data: datos,
      cantidad: datos.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene el rango de fechas disponible en la base de datos
exports.getRangoFechas = async (req, res, next) => {
  try {
    // Optimiza agregación proyectando solo el campo necesario
    const rango = await Sensor.aggregate([
      {
        $project: { time: 1 }
      },
      {
        $group: {
          _id: null,
          fechaMinima: { $min: '$time' },
          fechaMaxima: { $max: '$time' },
          totalRegistros: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: rango[0] || {},
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

// Búsqueda avanzada con múltiples filtros (CAMBIO: debe ser GET, no POST)
exports.buscarAvanzado = async (req, res, next) => {
  try {
    // Valida errores de express-validator
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    // CORRECCIÓN: usa req.query en vez de req.body ya que es GET
    const {
      texto,
      fechaInicio,
      fechaFin,
      minDecibeles,
      maxDecibeles,
      page = 1,
      limit = 100
    } = req.query;

    const filtro = {};

    // Búsqueda por texto en múltiples campos
    if (texto) {
      filtro.$or = [
        { 'deviceInfo.deviceName': new RegExp(texto, 'i') },
        { 'deviceInfo.tags.Address': new RegExp(texto, 'i') },
        { 'deviceInfo.tags.Description': new RegExp(texto, 'i') }
      ];
    }

    // Filtro de fechas
    if (fechaInicio || fechaFin) {
      filtro.time = {};
      if (fechaInicio) filtro.time.$gte = new Date(fechaInicio);
      if (fechaFin) filtro.time.$lte = new Date(fechaFin);
    }

    // Filtro de decibeles
    if (minDecibeles || maxDecibeles) {
      filtro['measurements.LAeq'] = {};
      if (minDecibeles) filtro['measurements.LAeq'].$gte = parseFloat(minDecibeles);
      if (maxDecibeles) filtro['measurements.LAeq'].$lte = parseFloat(maxDecibeles);
    }

    const pageInt = parseInt(page);
    const limitInt = Math.min(parseInt(limit), 1000); // Límite de seguridad
    const skip = (pageInt - 1) * limitInt;

    // Ejecuta consultas en paralelo
    const [datos, total] = await Promise.all([
      Sensor.find(filtro)
        .sort({ time: -1 })
        .skip(skip)
        .limit(limitInt)
        .lean(),
      Sensor.countDocuments(filtro)
    ]);

    res.json({
      success: true,
      data: datos,
      pagination: {
        total,
        page: pageInt,
        pages: Math.ceil(total / limitInt),
        limit: limitInt
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

// Exporta datos a formato CSV
exports.exportarCSV = async (req, res, next) => {
  try {
    // Valida errores de express-validator
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { fechaInicio, fechaFin, limit = 10000 } = req.query;
    const filtro = {};

    // Filtro de fechas
    if (fechaInicio || fechaFin) {
      filtro.time = {};
      if (fechaInicio) filtro.time.$gte = new Date(fechaInicio);
      if (fechaFin) filtro.time.$lte = new Date(fechaFin);
    }

    // CORRECCIÓN: Limita la cantidad de datos exportados para evitar timeout
    const limitInt = Math.min(parseInt(limit), 50000);

    const datos = await Sensor.find(filtro)
      .sort({ time: -1 })
      .limit(limitInt)
      .lean();

    // Genera CSV con encabezados
    let csv = 'Fecha,Dispositivo,Dirección,LAeq (dB),LAI,LAImax,Batería (%),Frecuencia\n';
    
    datos.forEach(d => {
      const fecha = new Date(d.time).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      const dispositivo = (d.deviceInfo?.deviceName || '').replace(/"/g, '""');
      const direccion = (d.deviceInfo?.tags?.Address || '').replace(/"/g, '""');
      const laeq = d.measurements?.LAeq || '';
      const lai = d.measurements?.LAI || '';
      const laimax = d.measurements?.LAImax || '';
      const bateria = d.measurements?.battery || '';
      const frecuencia = d.txInfo?.frequency || '';

      csv += `"${fecha}","${dispositivo}","${direccion}",${laeq},${lai},${laimax},${bateria},${frecuencia}\n`;
    });

    // CORRECCIÓN: Usa UTF-8 BOM para compatibilidad con Excel
    const BOM = '\uFEFF';
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename=datos-sonido-${Date.now()}.csv`);
    res.send(BOM + csv);
  } catch (error) {
    next(error);
  }
};

// Calcula estadísticas agregadas por hora
exports.estadisticasHora = async (req, res, next) => {
  try {
    // Valida errores de express-validator
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { fecha } = req.query;
    const filtro = {};

    // Filtra por día específico si se proporciona
    if (fecha) {
      const d = new Date(fecha);
      filtro.time = {
        $gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        $lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      };
    }

    // Optimiza agregación proyectando solo campos necesarios
    const stats = await Sensor.aggregate([
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
          promedio: { $avg: '$measurements.LAeq' },
          maximo: { $max: '$measurements.LAeq' },
          minimo: { $min: '$measurements.LAeq' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

// Calcula estadísticas agregadas por día
exports.estadisticasDia = async (req, res, next) => {
  try {
    // Valida errores de express-validator
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { dias = 30 } = req.query;
    const diasInt = Math.min(parseInt(dias), 365); // Límite máximo 1 año
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    // Optimiza agregación proyectando solo campos necesarios
    const stats = await Sensor.aggregate([
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
          promedio: { $avg: '$measurements.LAeq' },
          maximo: { $max: '$measurements.LAeq' },
          minimo: { $min: '$measurements.LAeq' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: stats,
      dias: diasInt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

// Obtiene alertas cuando los valores exceden umbrales definidos
exports.getAlertas = async (req, res, next) => {
  try {
    // Valida errores de express-validator
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { umbralBajo = 50, umbralAlto = 80, limit = 1000 } = req.query;
    const limitInt = Math.min(parseInt(limit), 5000); // Límite de seguridad

    // Encuentra valores fuera del rango normal
    const alertas = await Sensor.find({
      $or: [
        { 'measurements.LAeq': { $lt: parseFloat(umbralBajo) } },
        { 'measurements.LAeq': { $gt: parseFloat(umbralAlto) } }
      ]
    })
      .sort({ time: -1 })
      .limit(limitInt)
      .lean();

    res.json({
      success: true,
      data: alertas,
      umbralBajo: parseFloat(umbralBajo),
      umbralAlto: parseFloat(umbralAlto),
      cantidad: alertas.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
