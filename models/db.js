const mysql = require('mysql2/promise');

// const pool = mysql.createPool({
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,

//     waitForConnections: true,
//     connectionLimit: 10,
// });

// Test database
const pool = mysql.createPool({
    host: "localhost",
    port: 3306,
    user: "Dottoz",
    password: "Wmywbyt-123",
    database: "upload_test",

    waitForConnections: true,
    connectionLimit: 10
});

module.exports = pool;

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