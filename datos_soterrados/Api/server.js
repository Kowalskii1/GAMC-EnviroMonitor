const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

require('dotenv').config();


const PORT = 3000;
const MONGO_URI = "mongodb+srv://admin:admin@emergentes.yscexc1.mongodb.net/?appName=emergentes";
//const MONGO_URI = "mongodb://localhost:27017/";
const DB_NAME = "datos_soterrados";
//const DB_NAME = "soterradosDB";
const MAX_RECORDS = 5000;

//const COLLECTION_NAME = "sensores";
const COLLECTION_NAME = "data_soterrados";

if (!MONGO_URI || !DB_NAME) {
  console.error("Error: Faltan variables de entorno críticas (MONGODB_URI o DB_NAME).");
  console.log(`MONGO_URI: ${MONGO_URI}, DB_NAME: ${DB_NAME}`);
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cors());

async function main() {
  const client = new MongoClient(MONGO_URI);
  let sensoresCollection;

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    sensoresCollection = db.collection(COLLECTION_NAME);

    console.log(`Conectado a MongoDB (DB: ${DB_NAME}, Colección: ${COLLECTION_NAME})`);
    console.log(`Límite máximo de registros por consulta: ${MAX_RECORDS}`);

    app.get('/api', (req, res) => {
      res.json({
        message: "API de Sensores Soterrados del GAMC activa",
        db_status: "Conectado",
        db_name: DB_NAME,
        collection: COLLECTION_NAME
      });
    });

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
        console.error("Error en /api/sensores/status:", e);
        res.status(500).json({ error: e.message });
      }
    });

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
        console.error("Error en /api/sensores/alertas:", e);
        res.status(500).json({ error: e.message });
      }
    });

    app.get('/api/historial/sensor/:deviceName', async (req, res) => {
      try {
        const { deviceName } = req.params;
        const query = { deviceName };
        const resultado = await sensoresCollection.find(query)
          .sort({ time: -1 })
          .limit(MAX_RECORDS)
          .toArray();
        res.json(resultado);
      } catch (e) {
        console.error("Error en /api/historial/sensor/:deviceName:", e);
        res.status(500).json({ error: e.message });
      }
    });

    app.get('/api/historial/fechas', async (req, res) => {
      try {
        const { fechaInicio, fechaFin } = req.query;
        if (!fechaInicio || !fechaFin) {
          return res.status(400).json({ error: "Se requieren 'fechaInicio' y 'fechaFin' como parámetros de consulta." });
        }
        const query = { time: { $gte: fechaInicio, $lte: fechaFin } };
        const resultado = await sensoresCollection.find(query)
          .sort({ time: 1 })
          .limit(MAX_RECORDS)
          .toArray();
        res.json(resultado);
      } catch (e) {
        console.error("Error en /api/historial/fechas:", e);
        res.status(500).json({ error: e.message });
      }
    });

    app.get('/api/historial/reporte', async (req, res) => {
      try {
        const { deviceName, fechaInicio, fechaFin } = req.query;
        if (!deviceName || !fechaInicio || !fechaFin) {
          return res.status(400).json({ error: "Se requieren 'deviceName', 'fechaInicio' y 'fechaFin' como parámetros de consulta." });
        }
        const query = { deviceName, time: { $gte: fechaInicio, $lte: fechaFin } };
        const resultado = await sensoresCollection.find(query)
          .sort({ time: 1 })
          .limit(MAX_RECORDS)
          .toArray();
        res.json(resultado);
      } catch (e) {
        console.error("Error en /api/historial/reporte:", e);
        res.status(500).json({ error: e.message });
      }
    });

    app.get('/api/sensores/ubicacion', async (req, res) => {
      try {
        const { direccion } = req.query;
        if (!direccion) return res.status(400).json({ error: "El parámetro 'direccion' es requerido." });
        const query = { device_address: direccion };
        const resultado = await sensoresCollection.find(query)
          .sort({ time: -1 })
          .limit(MAX_RECORDS)
          .toArray();
        res.json(resultado);
      } catch (e) {
        console.error("Error en /api/sensores/ubicacion:", e);
        res.status(500).json({ error: e.message });
      }
    });

    app.get('/api/sensores/unicos', async (req, res) => {
      try {
        const resultado = await sensoresCollection.distinct("deviceName");
        res.json(resultado);
      } catch (e) {
        console.error("Error en /api/sensores/unicos:", e);
        res.status(500).json({ error: e.message });
      }
    });

    app.get('/api/ubicaciones/unicas', async (req, res) => {
      try {
        const resultado = await sensoresCollection.distinct("device_address");
        res.json(resultado);
      } catch (e) {
        console.error("Error en /api/ubicaciones/unicas:", e);
        res.status(500).json({ error: e.message });
      }
    });

    app.listen(PORT, () => {
      console.log(`Servidor API escuchando en http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error("Error al conectar con MongoDB o iniciar el servidor:", err);
    process.exit(1);
  }
}

main();
