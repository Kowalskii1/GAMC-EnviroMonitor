const Sensor = require('../models/Sensor');
const { validationResult } = require('express-validator');

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

exports.getDatos = async (req, res, next) => {
  try {
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

    if (fechaInicio || fechaFin) {
      filtro.time = {};
      if (fechaInicio) filtro.time.$gte = new Date(fechaInicio);
      if (fechaFin) filtro.time.$lte = new Date(fechaFin);
    }

    if (minDecibeles || maxDecibeles) {
      filtro['object.LAeq'] = {};
      if (minDecibeles) filtro['object.LAeq'].$gte = parseFloat(minDecibeles);
      if (maxDecibeles) filtro['object.LAeq'].$lte = parseFloat(maxDecibeles);
    }

    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;

    const [datos, total] = await Promise.all([
      Sensor.find(filtro)
        .sort(sort)
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

exports.getDatoById = async (req, res, next) => {
  try {
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

exports.getUltimas = async (req, res, next) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { cantidad = 50 } = req.query;
    const cantidadInt = parseInt(cantidad);

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

exports.getRangoFechas = async (req, res, next) => {
  try {
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

exports.buscarAvanzado = async (req, res, next) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

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

    if (texto) {
      filtro.$or = [
        { devAddr: new RegExp(texto, 'i') },
        { 'deviceInfo.deviceName': new RegExp(texto, 'i') },
        { 'deviceInfo.tags.Address': new RegExp(texto, 'i') },
        { 'deviceInfo.tags.Description': new RegExp(texto, 'i') }
      ];
    }

    if (fechaInicio || fechaFin) {
      filtro.time = {};
      if (fechaInicio) filtro.time.$gte = new Date(fechaInicio);
      if (fechaFin) filtro.time.$lte = new Date(fechaFin);
    }

    if (minDecibeles || maxDecibeles) {
      filtro['object.LAeq'] = {};
      if (minDecibeles) filtro['object.LAeq'].$gte = parseFloat(minDecibeles);
      if (maxDecibeles) filtro['object.LAeq'].$lte = parseFloat(maxDecibeles);
    }

    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;

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

exports.exportarCSV = async (req, res, next) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { fechaInicio, fechaFin, limit = 50000 } = req.query;
    const filtro = {};

    if (fechaInicio || fechaFin) {
      filtro.time = {};
      if (fechaInicio) filtro.time.$gte = new Date(fechaInicio);
      if (fechaFin) filtro.time.$lte = new Date(fechaFin);
    }

    const limitInt = parseInt(limit);

    const datos = await Sensor.find(filtro)
      .sort({ time: -1 })
      .limit(limitInt)
      .lean();

    let csv = 'Fecha,Dispositivo,DevAddr,LAeq (dB),LAI,LAImax,Batería (%),Frecuencia\n';
    
    datos.forEach(d => {
      const fecha = new Date(d.time).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      const dispositivo = (d.deviceInfo?.deviceName || '').replace(/"/g, '""');
      const devAddr = d.devAddr || '';
      const laeq = d.object?.LAeq || '';
      const lai = d.object?.LAI || '';
      const laimax = d.object?.LAImax || '';
      const bateria = d.object?.battery || d.batteryLevel || '';
      const frecuencia = d.txInfo?.frequency || '';

      csv += `"${fecha}","${dispositivo}","${devAddr}",${laeq},${lai},${laimax},${bateria},${frecuencia}\n`;
    });

    const BOM = '\uFEFF';
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename=datos-sonido-${Date.now()}.csv`);
    res.send(BOM + csv);
  } catch (error) {
    next(error);
  }
};

exports.estadisticasHora = async (req, res, next) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { fecha } = req.query;
    const filtro = {};

    if (fecha) {
      const d = new Date(fecha);
      filtro.time = {
        $gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        $lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      };
    }

    const stats = await Sensor.aggregate([
      { $match: filtro },
      {
        $project: {
          hora: { $hour: '$time' },
          'object.LAeq': 1
        }
      },
      {
        $group: {
          _id: '$hora',
          promedio: { $avg: '$object.LAeq' },
          maximo: { $max: '$object.LAeq' },
          minimo: { $min: '$object.LAeq' },
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

exports.estadisticasDia = async (req, res, next) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { dias = 30 } = req.query;
    const diasInt = parseInt(dias);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - diasInt);

    const stats = await Sensor.aggregate([
      {
        $match: {
          time: { $gte: fechaInicio }
        }
      },
      {
        $project: {
          fecha: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
          'object.LAeq': 1
        }
      },
      {
        $group: {
          _id: '$fecha',
          promedio: { $avg: '$object.LAeq' },
          maximo: { $max: '$object.LAeq' },
          minimo: { $min: '$object.LAeq' },
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

exports.getAlertas = async (req, res, next) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return;

    const { umbralBajo = 50, umbralAlto = 80, limit = 1000 } = req.query;
    const limitInt = parseInt(limit);

    const alertas = await Sensor.find({
      $or: [
        { 'object.LAeq': { $lt: parseFloat(umbralBajo) } },
        { 'object.LAeq': { $gt: parseFloat(umbralAlto) } }
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
