const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URI = "mongodb://localhost:27017/";
const DB_NAME = "soterradosDB";
const COLLECTION_NAME = "sensores";

let sensoresCollection;

app.use(express.json());
app.use(cors());

async function connectToDb() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();

    const db = client.db(DB_NAME);
    sensoresCollection = db.collection(COLLECTION_NAME);

    console.log(`Conectado a MongoDB (DB: ${DB_NAME})`);

    app.listen(PORT, () => {
      console.log(`Servidor API escuchando en http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error("Error al conectar con MongoDB:", err);
    process.exit(1);
  }
}

// Rutas
app.get('/api', (req, res) => {
  res.json({ message: "API de Sensores Soterrados del GAMC activa" });
});

// Último estado por sensor
app.get('/api/sensores/status', async (req, res) => {
  try {
    const pipeline = [
      { $sort: { "time": -1 } },
      { $group: { _id: "$deviceName", ultimaLectura: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$ultimaLectura" } }
    ];
    const resultado = await sensoresCollection.aggregate(pipeline).toArray();
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Sensores actualmente en alerta (ej. data == "0")
app.get('/api/sensores/alertas', async (req, res) => {
  try {
    const pipeline = [
      { $sort: { "time": -1 } },
      { $group: { _id: "$deviceName", ultimaLectura: { $first: "$$ROOT" } } },
      { $match: { "ultimaLectura.data": "0" } },
      { $replaceRoot: { newRoot: "$ultimaLectura" } }
    ];
    const resultado = await sensoresCollection.aggregate(pipeline).toArray();
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Historial por sensor
app.get('/api/historial/sensor/:deviceName', async (req, res) => {
  try {
    const { deviceName } = req.params;
    const query = { deviceName };
    const resultado = await sensoresCollection.find(query)
      .sort({ time: -1 })
      .limit(500)
      .toArray();
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Historial por rango de fechas
app.get('/api/historial/fechas', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: "Se requieren 'fechaInicio' y 'fechaFin' como parámetros de consulta." });
    }
    const query = { time: { $gte: fechaInicio, $lte: fechaFin } };
    const resultado = await sensoresCollection.find(query).sort({ time: 1 }).toArray();
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reporte por sensor y fechas
app.get('/api/historial/reporte', async (req, res) => {
  try {
    const { deviceName, fechaInicio, fechaFin } = req.query;
    if (!deviceName || !fechaInicio || !fechaFin) {
      return res.status(400).json({ error: "Se requieren 'deviceName', 'fechaInicio' y 'fechaFin' como parámetros de consulta." });
    }
    const query = { deviceName, time: { $gte: fechaInicio, $lte: fechaFin } };
    const resultado = await sensoresCollection.find(query).sort({ time: 1 }).toArray();
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Historial por ubicación
app.get('/api/sensores/ubicacion', async (req, res) => {
  try {
    const { direccion } = req.query;
    if (!direccion) return res.status(400).json({ error: "El parámetro 'direccion' es requerido." });
    const query = { device_address: direccion };
    const resultado = await sensoresCollection.find(query).sort({ time: -1 }).toArray();
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoints auxiliares
app.get('/api/sensores/unicos', async (req, res) => {
  try {
    const resultado = await sensoresCollection.distinct("deviceName");
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ubicaciones/unicas', async (req, res) => {
  try {
    const resultado = await sensoresCollection.distinct("device_address");
    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

connectToDb();