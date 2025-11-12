// middleware/errorHandler.js
module.exports = (err, req, res, next) => {
  console.error('Error:', err.message);

  // ❌ NO PONGAS NADA DE CORS AQUÍ
  
  const statusCode = err.status || err.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack 
    })
  });
};
