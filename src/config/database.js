import mongoose from 'mongoose';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Conexión a MongoDB
export const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB conectado exitosamente');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

// Pool de conexiones MySQL
export const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Verificar conexión MySQL
export const testMySQLConnection = async () => {
  try {
    const connection = await mysqlPool.getConnection();
    console.log('✅ MySQL conectado exitosamente');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MySQL:', error.message);
    return false;
  }
};

// Crear tabla de backup en MySQL si no existe
export const initMySQLBackup = async () => {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS records_backup (
      id VARCHAR(255) PRIMARY KEY,
      data JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  
  try {
    await mysqlPool.query(createTableSQL);
    console.log('✅ Tabla de backup MySQL creada/verificada');
  } catch (error) {
    console.error('❌ Error creando tabla de backup:', error.message);
  }
};