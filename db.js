const mysql = require('mysql2');

// We use process.env to hide your database credentials securely
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Export the pool to be used in your server.js
module.exports = pool;
