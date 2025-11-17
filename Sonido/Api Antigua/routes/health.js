const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/', (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  const healthInfo = {
    status: mongoStatus === 'connected' ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    mongodb: mongoStatus,
    uptime: Math.floor(process.uptime())
  };

  if (process.env.NODE_ENV === 'development') {
    healthInfo.environment = process.env.NODE_ENV;
    healthInfo.nodeVersion = process.version;
  }

  const statusCode = mongoStatus === 'connected' ? 200 : 503;
  res.status(statusCode).json(healthInfo);
});

module.exports = router;
