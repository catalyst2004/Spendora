const mysql = require('mysql2');

// 1. Fail-Safe: This forces an immediate, clear error in the Vercel logs 
// if the environment variable is missing or empty.
if (!process.env.DATABASE_URL) {
  throw new Error("CRITICAL ERROR: Vercel is not reading the DATABASE_URL environment variable!");
}

// 2. Direct Connection: Passing the string directly is the most reliable 
// method for mysql2 to parse a cloud database link.
const pool = mysql.createPool(process.env.DATABASE_URL);

module.exports = pool;