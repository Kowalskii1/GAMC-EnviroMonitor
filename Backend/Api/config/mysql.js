const mysql = require('mysql2/promise');

let pool;

const config = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: 3306, // Puerto por defecto de MySQL
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // 🔥 CORRECCIÓN: Configuración SSL flexible
    ssl: false // Desactivar SSL completamente
};

async function connectMySQL() {
    try {
        if (!pool) {
            console.log('🔄 Conectando a MySQL...');
            
            // Intentar primero sin SSL
            try {
                pool = mysql.createPool(config);
                const connection = await pool.getConnection();
                console.log('✅ MySQL conectado exitosamente (sin SSL)');
                console.log(`📁 Base de datos: ${process.env.MYSQL_DATABASE}`);
                console.log(`📊 Host: ${process.env.MYSQL_HOST}`);
                connection.release();
            } catch (sslError) {
                console.log('⚠️  Intento sin SSL falló, probando con configuración alternativa...');
                
                // Si falla, intentar con configuración SSL permisiva
                const altConfig = {
                    ...config,
                    ssl: {
                        rejectUnauthorized: false,
                        // No verificar certificado
                        ca: undefined
                    }
                };
                
                pool = mysql.createPool(altConfig);
                const connection = await pool.getConnection();
                console.log('✅ MySQL conectado exitosamente (con SSL permisivo)');
                console.log(`📁 Base de datos: ${process.env.MYSQL_DATABASE}`);
                console.log(`📊 Host: ${process.env.MYSQL_HOST}`);
                connection.release();
            }
        }
        return pool;
    } catch (error) {
        console.error('❌ Error conectando a MySQL:', error.message);
        console.error('Detalles:', {
            host: process.env.MYSQL_HOST,
            database: process.env.MYSQL_DATABASE,
            user: process.env.MYSQL_USER
        });
        throw error;
    }
}

async function getConnection() {
    if (!pool) {
        await connectMySQL();
    }
    return pool;
}

async function closeMySQL() {
    if (pool) {
        await pool.end();
        console.log('✅ MySQL desconectado');
        pool = null;
    }
}

module.exports = {
    connectMySQL,
    getConnection,
    closeMySQL
};
