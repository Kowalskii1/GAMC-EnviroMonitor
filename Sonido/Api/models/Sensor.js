const mongoose = require('mongoose');

// Esquema para datos de sensores de sonido con información de dispositivo LoRaWAN
const sensorSchema = new mongoose.Schema({
  _id: String, // ID personalizado del documento
  devAddr: String, // Dirección del dispositivo LoRaWAN
  deduplicationId: String, // ID para evitar duplicados
  
  // Timestamp de la medición - campo crítico para consultas temporales
  time: {
    type: Date,
    required: true,
    index: true
  },
  
  // Información del dispositivo
  deviceInfo: {
    deviceName: {
      type: String,
      index: true // Índice para búsquedas por nombre de dispositivo
    },
    applicationName: String,
    devEui: String,
    tags: {
      Description: String,
      Address: {
        type: String,
        index: true // Índice para búsquedas por ubicación
      },
      Location: String,
      Name: String
    }
  },
  
  // Mediciones de sonido y batería
  measurements: {
    LAeq: {
      type: Number,
      index: true, // Índice para filtros por nivel de ruido
      min: 0, // Validación: decibeles no pueden ser negativos
      max: 200 // Límite superior razonable
    },
    LAI: {
      type: Number,
      min: 0,
      max: 200
    },
    LAImax: {
      type: Number,
      min: 0,
      max: 200
    },
    battery: {
      type: Number,
      min: 0,
      max: 100, // Porcentaje de batería
      index: true // Índice para monitoreo de batería baja
    }
  },
  
  // Información de transmisión LoRaWAN
  txInfo: {
    modulation: {
      lora: {
        spreadingFactor: Number,
        bandwidth: Number,
        codeRate: String
      }
    },
    frequency: Number
  },
  
  fPort: Number, // Puerto de aplicación LoRaWAN
  fCnt: {
    type: Number,
    index: true // Índice para detección de paquetes perdidos
  },
  confirmed: Boolean, // Indica si requiere confirmación
  adr: Boolean, // Adaptive Data Rate habilitado
  dr: Number, // Data Rate
  
  // Información de recepción de múltiples gateways
  rxInfo: [{
    rssi: Number, // Intensidad de señal recibida
    snr: Number, // Relación señal/ruido
    metadata: {
      region_config_id: String,
      region_common_name: String
    },
    nsTime: String
  }]
}, {
  timestamps: true, // Crea automáticamente createdAt y updatedAt
  collection: 'sensor_data'
});

// ==================== ÍNDICES COMPUESTOS ====================

// Índice principal: consultas por rango de tiempo y filtro de decibeles
// Sigue la regla ESR (Equality, Sort, Range)
sensorSchema.index({ time: -1, 'measurements.LAeq': 1 });

// Índice para consultas ordenadas por fecha de creación
sensorSchema.index({ createdAt: -1 });

// Índice para búsquedas por dispositivo específico
sensorSchema.index({ 'deviceInfo.deviceName': 1, time: -1 });

// Índice para alertas de batería baja ordenadas por tiempo
sensorSchema.index({ 'measurements.battery': 1, time: -1 });

// Índice compuesto para búsquedas avanzadas por ubicación y tiempo
sensorSchema.index({ 
  'deviceInfo.tags.Address': 1, 
  time: -1 
});

// Índice para búsqueda de texto en descripción y dirección
sensorSchema.index({
  'deviceInfo.tags.Description': 'text',
  'deviceInfo.tags.Address': 'text'
});

// Índice compuesto para detección de anomalías (valores extremos)
// Útil para la función getAlertas
sensorSchema.index({ 
  'measurements.LAeq': 1, 
  time: -1 
}, {
  name: 'alertas_index'
});

// Índice sparse para fCnt - solo indexa documentos que tienen este campo
sensorSchema.index({ fCnt: 1 }, { sparse: true });

// ==================== MÉTODOS ESTÁTICOS ====================

/**
 * Obtiene estadísticas de un rango de fechas
 * @param {Date} fechaInicio - Fecha inicial del rango
 * @param {Date} fechaFin - Fecha final del rango
 * @returns {Promise} Estadísticas agregadas
 */
sensorSchema.statics.getEstadisticasRango = async function(fechaInicio, fechaFin) {
  return this.aggregate([
    {
      $match: {
        time: { $gte: fechaInicio, $lte: fechaFin }
      }
    },
    {
      $group: {
        _id: null,
        promedio: { $avg: '$measurements.LAeq' },
        maximo: { $max: '$measurements.LAeq' },
        minimo: { $min: '$measurements.LAeq' },
        desviacion: { $stdDevPop: '$measurements.LAeq' },
        total: { $sum: 1 }
      }
    }
  ]);
};

/**
 * Encuentra dispositivos con batería baja
 * @param {Number} umbral - Nivel de batería considerado bajo (default: 20%)
 * @returns {Promise} Array de dispositivos con batería baja
 */
sensorSchema.statics.getBateriaBaja = async function(umbral = 20) {
  return this.find({
    'measurements.battery': { $lte: umbral }
  })
  .select('deviceInfo.deviceName measurements.battery time')
  .sort({ 'measurements.battery': 1 })
  .lean();
};

// ==================== MÉTODOS DE INSTANCIA ====================

/**
 * Verifica si la medición está fuera del rango normal
 * @param {Number} umbralBajo - Umbral inferior
 * @param {Number} umbralAlto - Umbral superior
 * @returns {Boolean}
 */
sensorSchema.methods.esAlerta = function(umbralBajo = 50, umbralAlto = 80) {
  const laeq = this.measurements?.LAeq;
  if (!laeq) return false;
  return laeq < umbralBajo || laeq > umbralAlto;
};

// ==================== MIDDLEWARE ====================

// Middleware pre-save para validación adicional
sensorSchema.pre('save', function(next) {
  // Asegura que time nunca esté en el futuro
  if (this.time > new Date()) {
    this.time = new Date();
  }
  next();
});

// Middleware post-save para logging (opcional en desarrollo)
if (process.env.NODE_ENV === 'development') {
  sensorSchema.post('save', function(doc) {
    console.log('Nuevo documento guardado:', doc._id);
  });
}

// ==================== CONFIGURACIÓN DE ÍNDICES ====================

// Asegura que los índices se creen al iniciar la aplicación
sensorSchema.set('autoIndex', process.env.NODE_ENV === 'development');

module.exports = mongoose.model('SensorData', sensorSchema);
