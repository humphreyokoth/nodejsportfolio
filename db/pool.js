const mysql = require("mysql2/promise");
const { getMysqlConfig } = require("./mysqlConfig");

let sharedPool = null;

function getPool() {
  if (sharedPool) return sharedPool;

  const config = getMysqlConfig();
  if (!config) return null;

  const connectTimeoutMs = Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 60000);
  const maxConnections = Number(process.env.MYSQL_CONNECTION_LIMIT || 10);

  sharedPool = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    port: config.port,
    waitForConnections: true,
    connectionLimit: maxConnections,
    ssl: config.ssl,
    connectTimeout: connectTimeoutMs,
  });

  return sharedPool;
}

module.exports = { getPool };
