// middleware/logger.js

const winston = require('winston');
const path = require('path');

/**
 * Configuración de Winston Logger para la aplicación
 * Maneja logs de múltiples niveles con transports personalizados
 */

// Define formato personalizado con timestamp
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    // Si hay stack trace (error), lo incluye
    return stack 
      ? `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
      : `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

// Crea el logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Transport para errores (solo nivel error)
    new winston.transports.File({ 
      filename: path.join('logs', 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Transport para todos los logs
    new winston.transports.File({ 
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10
    })
  ],
  // Previene que el proceso termine en excepciones no capturadas
  exitOnError: false
});

// En desarrollo, también muestra logs en consola con colores
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Stream para integración con Morgan (logger HTTP)
logger.stream = {
  write: (message) => {
    // Morgan envía logs con salto de línea, lo removemos
    logger.http(message.trim());
  }
};

// Captura excepciones no manejadas y las registra
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: path.join('logs', 'exceptions.log') 
  })
);

// Captura promesas rechazadas sin catch
logger.rejections.handle(
  new winston.transports.File({ 
    filename: path.join('logs', 'rejections.log') 
  })
);

module.exports = logger;
