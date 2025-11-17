const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

const MONGO2_URI = "mongodb+srv://admin:admin@emergentes.yscexc1.mongodb.net/?appName=emergentes";
const DB_NAME = "datos_soterrados";
const COLLECTION = "data_soterrados";
const MAX_RECORDS = 5000;

let collection = null;

async function initMongo() {
  try {
    const client = new MongoClient(MONGO2_URI);
    await client.connect();
    collection = client.db(DB_NAME).collection(COLLECTION);
    console.log("📌 Mongo2 Soterrados conectado");
  } catch (err) {
    console.error("❌ Error iniciando Mongo Soterrados:", err);
  }
}
initMongo();

router.use((req, res, next) => {
  if (!collection) {
    return res.status(503).json({ 
      error: "Base de datos Soterrados no lista, intenta nuevamente." 
    });
  }
  next();
});


//ENDPOINTS 
router.get('/', (req, res) => {
  res.json({
    message: "API Soterrados Activa",
    db: DB_NAME,
    collection: COLLECTION
  });
});

//Sensores Unicos
router.get('/unicos', async (req, res) => {
  try {
    const sensores = await collection.distinct("deviceName");
    res.json(sensores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Ultima lectura por sensor
router.get('/status', async (req, res) => {
  try {
    const pipeline = [
      { $sort: { time: -1 } },
      { $group: { _id: "$deviceName", ultimaLectura: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$ultimaLectura" } }
    ];
    const result = await collection.aggregate(pipeline).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Alertas
router.get('/alertas', async (req, res) => {
  try {
    const pipeline = [
      { $sort: { time: -1 } },
      { $group: { _id: "$deviceName", ultimaLectura: { $first: "$$ROOT" } } },
      { $match: { "ultimaLectura.data": "0" } },
      { $replaceRoot: { newRoot: "$ultimaLectura" } }
    ];
    const resultado = await collection.aggregate(pipeline).toArray();
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Historial por sensor
router.get('/historial/:device', async (req, res) => {
  try {
    const normalized = req.params.device
      .toString()
      .replace(/\s+/g, "")
      .replace(/[–—]/g, "-")
      .toUpperCase();

    const query = {
      deviceName: { $regex: new RegExp(`^${normalized}$`, "i") }
    };

    const result = await collection.find(query)
      .sort({ time: -1 })
      .limit(MAX_RECORDS)
      .toArray();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Historial por fechas
router.get('/historial/fechas', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: "Se requieren 'fechaInicio' y 'fechaFin'." });
    }

    const result = await collection.find({
      time: { $gte: fechaInicio, $lte: fechaFin }
    })
      .sort({ time: 1 })
      .limit(MAX_RECORDS)
      .toArray();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//Reporte
router.get('/historial/reporte', async (req, res) => {
  try {
    const { deviceName, fechaInicio, fechaFin } = req.query;

    if (!deviceName || !fechaInicio || !fechaFin) {
      return res.status(400).json({
        error: "Se requieren deviceName, fechaInicio y fechaFin."
      });
    }

    const normalized = deviceName
      .toString()
      .replace(/\s+/g, "")
      .replace(/[–—]/g, "-")
      .toUpperCase();

    const query = {
      deviceName: { $regex: new RegExp(`^${normalized}$`, "i") },
      time: { $gte: fechaInicio, $lte: fechaFin }
    };

    const result = await collection.find(query)
      .sort({ time: 1 })
      .limit(MAX_RECORDS)
      .toArray();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Filtrar Direccion
router.get('/ubicacion', async (req, res) => {
  try {
    const { direccion } = req.query;

    if (!direccion) {
      return res.status(400).json({ error: "El parámetro 'direccion' es requerido." });
    }

    const result = await collection.find({ device_address: direccion })
      .sort({ time: -1 })
      .limit(MAX_RECORDS)
      .toArray();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Lista direcciones
router.get('/ubicaciones/unicas', async (req, res) => {
  try {
    const resultado = await collection.distinct("device_address");
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
