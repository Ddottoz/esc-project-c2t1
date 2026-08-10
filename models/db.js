require('dotenv').config(); 
const mysql = require('mysql2/promise');

// Main railway database
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10)
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


// Connection test
// (async () => {
//     try {
//         const connection = await pool.getConnection();
//         console.log("Connected to Railway MySQL!");
//         connection.release();
//     } catch (err) {
//         console.error("Failed to connect to MySQL:");
//         console.error(err);
//     }
// })();

module.exports = pool;