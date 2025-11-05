const mongoose = require('mongoose');

const sensorSchema = new mongoose.Schema({
  _id: String,
  devAddr: String,
  deduplicationId: String,
  time: {
    type: Date,
    required: true,
    index: true
  },
  deviceInfo: {
    deviceName: String,
    applicationName: String,
    devEui: String,
    tags: {
      Description: String,
      Address: String,
      Location: String,
      Name: String
    }
  },
  measurements: {
    LAeq: {
      type: Number,
      index: true,
      sparse: true
    },
    LAI: Number,
    LAImax: Number,
    battery: Number
  },
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
  fPort: Number,
  fCnt: {
    type: Number,
    index: true
  },
  confirmed: Boolean,
  adr: Boolean,
  dr: Number,
  rxInfo: [{
    rssi: Number,
    snr: Number,
    metadata: {
      region_config_id: String,
      region_common_name: String
    },
    nsTime: String
  }]
}, {
  timestamps: true,
  collection: 'sensor_data'
});

// Índices compuestos
sensorSchema.index({ time: -1, 'measurements.LAeq': 1 });
sensorSchema.index({ createdAt: -1 });
sensorSchema.index({ 'deviceInfo.deviceName': 1 });

module.exports = mongoose.model('SensorData', sensorSchema);
