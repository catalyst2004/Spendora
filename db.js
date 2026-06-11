const mysql = require('mysql2');

if (!process.env.DATABASE_URL) {
  throw new Error("CRITICAL ERROR: Vercel is not reading the DATABASE_URL environment variable!");
}

const pool = mysql.createPool(process.env.DATABASE_URL);

// Add .promise() right here!
module.exports = pool.promise();