// middleware/requestLogger.js 

const logger = require('./logger');

/**
 * Middleware personalizado para logging de peticiones HTTP
 * Registra información detallada de cada request/response
 */
module.exports = (req, res, next) => {
  const startTime = Date.now();
  
  // Log de inicio de petición
  logger.info(`Petición entrante: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Captura el evento de finalización de la respuesta
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel](`Respuesta enviada: ${req.method} ${req.originalUrl}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });

  next();
};
