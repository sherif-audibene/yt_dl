const mysql = require('mysql2/promise');
const { db } = require('../config');

// Create a connection pool (recommended for web apps)
const pool = mysql.createPool({
  host: db.host,
  port: db.port,
  database: db.database,
  user: db.user,
  password: db.password,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Execute a query with parameters
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
const query = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

/**
 * Get a connection from the pool (for transactions)
 * @returns {Promise<Connection>}
 */
const getConnection = () => pool.getConnection();

/**
 * Test the database connection
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✓ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  getConnection,
  testConnection,
};

