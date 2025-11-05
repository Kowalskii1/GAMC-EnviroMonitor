const Sensor = require('../models/Sensor');

// Obtener datos con filtros
exports.getDatos = async (req, res) => {
  try {
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
      filtro['measurements.LAeq'] = {};
      if (minDecibeles) filtro['measurements.LAeq'].$gte = parseFloat(minDecibeles);
      if (maxDecibeles) filtro['measurements.LAeq'].$lte = parseFloat(maxDecibeles);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [datos, total] = await Promise.all([
      Sensor.find(filtro)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Sensor.countDocuments(filtro)
    ]);

    res.json({
      success: true,
      data: datos,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Obtener por ID
exports.getDatoById = async (req, res) => {
  try {
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
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Últimas mediciones
exports.getUltimas = async (req, res) => {
  try {
    const { cantidad = 50 } = req.query;

    const datos = await Sensor.find()
      .sort({ time: -1 })
      .limit(parseInt(cantidad))
      .lean();

    res.json({
      success: true,
      data: datos,
      cantidad: datos.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Rango de fechas
exports.getRangoFechas = async (req, res) => {
  try {
    const rango = await Sensor.aggregate([
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
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Búsqueda avanzada
exports.buscarAvanzado = async (req, res) => {
  try {
    const {
      texto,
      fechaInicio,
      fechaFin,
      minDecibeles,
      maxDecibeles,
      page = 1,
      limit = 100
    } = req.body;

    const filtro = {};

    if (texto) {
      filtro.$or = [
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
      filtro['measurements.LAeq'] = {};
      if (minDecibeles) filtro['measurements.LAeq'].$gte = parseFloat(minDecibeles);
      if (maxDecibeles) filtro['measurements.LAeq'].$lte = parseFloat(maxDecibeles);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [datos, total] = await Promise.all([
      Sensor.find(filtro)
        .sort({ time: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Sensor.countDocuments(filtro)
    ]);

    res.json({
      success: true,
      data: datos,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Exportar CSV
exports.exportarCSV = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const filtro = {};

    if (fechaInicio || fechaFin) {
      filtro.time = {};
      if (fechaInicio) filtro.time.$gte = new Date(fechaInicio);
      if (fechaFin) filtro.time.$lte = new Date(fechaFin);
    }

    const datos = await Sensor.find(filtro).lean();

    let csv = 'Fecha,Dispositivo,Dirección,LAeq (dB),LAI,LAImax,Batería (%),Frecuencia\n';
    
    datos.forEach(d => {
      const fecha = new Date(d.time).toLocaleString('es-BO');
      const dispositivo = d.deviceInfo?.deviceName || '';
      const direccion = d.deviceInfo?.tags?.Address || '';
      const laeq = d.measurements?.LAeq || '';
      const lai = d.measurements?.LAI || '';
      const laimax = d.measurements?.LAImax || '';
      const bateria = d.measurements?.battery || '';
      const frecuencia = d.txInfo?.frequency || '';

      csv += `"${fecha}","${dispositivo}","${direccion}",${laeq},${lai},${laimax},${bateria},${frecuencia}\n`;
    });

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename=datos-sonido.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Estadísticas por hora
exports.estadisticasHora = async (req, res) => {
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

    const stats = await Sensor.aggregate([
      { $match: filtro },
      {
        $group: {
          _id: { $hour: '$time' },
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
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Estadísticas por día
exports.estadisticasDia = async (req, res) => {
  try {
    const { dias = 30 } = req.query;
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - parseInt(dias));

    const stats = await Sensor.aggregate([
      {
        $match: {
          time: { $gte: fechaInicio }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
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
      dias: parseInt(dias),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Alertas
exports.getAlertas = async (req, res) => {
  try {
    const { umbralBajo = 50, umbralAlto = 80 } = req.query;

    const alertas = await Sensor.find({
      $or: [
        { 'measurements.LAeq': { $lt: parseFloat(umbralBajo) } },
        { 'measurements.LAeq': { $gt: parseFloat(umbralAlto) } }
      ]
    })
      .sort({ time: -1 })
      .limit(1000)
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
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = exports;
