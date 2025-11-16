const mongoose = require('mongoose');

const rxInfoSchema = new mongoose.Schema({
  gatewayID: String,
  uplinkID: String,
  name: String,
  time: Date,
  rssi: Number,
  loRaSNR: Number,
  location: {
    latitude: Number,
    longitude: Number,
    altitude: Number
  }
}, { _id: false });

const txInfoSchema = new mongoose.Schema({
  frequency: Number,
  modulation: String,
  loRaModulationInfo: {
    bandwidth: Number,
    spreadingFactor: Number,
    codeRate: String
  }
}, { _id: false });

const deviceInfoSchema = new mongoose.Schema({
  tenantID: String,
  tenantName: String,
  applicationID: String,
  applicationName: String,
  deviceProfileID: String,
  deviceProfileName: String,
  deviceName: String,
  devEui: String,
  deviceClassEnabled: String,
  tags: mongoose.Schema.Types.Mixed
}, { _id: false });

const objectSchema = new mongoose.Schema({
  LAeq: Number,
  LAI: Number,
  LAImax: Number,
  battery: Number
}, { _id: false });

const sensorSchema = new mongoose.Schema({
  devAddr: {
    type: String,
    required: true,
    index: true
  },
  deduplicationId: {
    type: String,
    required: true,
    unique: true
  },
  time: {
    type: Date,
    required: true,
    index: true
  },
  deviceInfo: deviceInfoSchema,
  txInfo: txInfoSchema,
  fPort: String,
  data: String,
  fCnt: Number,
  confirmed: String,
  adr: String,
  dr: String,
  rxInfo: [rxInfoSchema],
  object: objectSchema,
  margin: String,
  batteryLevelUnavailable: String,
  externalPowerSource: String,
  batteryLevel: String
}, {
  timestamps: false,
  collection: 'sonido_raw'
});

// Índices optimizados
sensorSchema.index({ time: -1 });
sensorSchema.index({ devAddr: 1, time: -1 });
sensorSchema.index({ 'object.LAeq': 1 });
sensorSchema.index({ 'object.battery': 1 });

const Sensor = mongoose.model('Sensor', sensorSchema);

module.exports = Sensor;
