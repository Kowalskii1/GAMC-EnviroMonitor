// middleware/errorHandler.js

/**
 * Middleware global de manejo de errores para Express
 * Debe ser el último middleware registrado en la aplicación
 * Captura y procesa todos los errores pasados con next(err)
 */
module.exports = (err, req, res, next) => {
  // Log detallado del error en servidor
  console.error('❌ Error capturado:', {
    message: err.message,
    status: err.status || err.statusCode || 500,
    path: req.path,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Determina el código de estado HTTP apropiado
  const statusCode = err.status || err.statusCode || 500;
  
  // Construye respuesta de error
  const errorResponse = {
    success: false,
    error: statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor' // Mensaje genérico en producción
      : err.message, // Mensaje específico en desarrollo
    path: req.path,
    timestamp: new Date().toISOString()
  };

  // Incluye stack trace solo en desarrollo
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Envía respuesta al cliente
  res.status(statusCode).json(errorResponse);
};
