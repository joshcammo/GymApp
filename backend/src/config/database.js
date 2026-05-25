const sql = require('mssql');

const config = {
  server:   process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user:     process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  port:     1433,
  options: {
    encrypt:                true,   // Required for Azure SQL
    trustServerCertificate: false,  // Don't trust self-signed certs in prod
    enableArithAbort:       true,
    connectTimeout:         30000,
    requestTimeout:         30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

/** Singleton connection pool — reused across requests */
let pool = null;

async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(config);
      console.log('✅ Connected to Azure SQL Database');
    } catch (err) {
      pool = null;
      console.error('❌ Azure SQL connection failed:', err.message);
      throw err;
    }
  }
  return pool;
}

// Gracefully close the pool when the process exits
process.on('SIGINT', async () => {
  if (pool) {
    await pool.close();
    console.log('Database pool closed.');
  }
  process.exit(0);
});

module.exports = { getPool, sql };
