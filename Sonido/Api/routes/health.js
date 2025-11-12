const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Endpoint de health check para monitoreo de sistema
router.get('/', (req, res) => {
  // Verifica el estado de conexión de MongoDB (1 = conectado)
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  // Construye respuesta con información del sistema
  const healthInfo = {
    status: mongoStatus === 'connected' ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    mongodb: mongoStatus,
    uptime: Math.floor(process.uptime())
  };

  // Solo incluye información sensible en desarrollo
  if (process.env.NODE_ENV === 'development') {
    healthInfo.environment = process.env.NODE_ENV;
    healthInfo.nodeVersion = process.version;
  }

  // Retorna 503 si la base de datos no está conectada
  const statusCode = mongoStatus === 'connected' ? 200 : 503;
  res.status(statusCode).json(healthInfo);
});

module.exports = router;
