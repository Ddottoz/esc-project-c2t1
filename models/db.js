require('dotenv').config(); 
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10), 
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const connection = await pool.getConnection();
      console.log('Successfully connected to Railway MySQL database!');
      connection.release();
    } catch (err) {
      console.error('Database connection failed:', err.message);
    }
  })();
}

module.exports = pool;