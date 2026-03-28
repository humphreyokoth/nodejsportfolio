const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function isSafeDatabaseName(name) {
  if (typeof name !== "string") return false;
  return /^[a-zA-Z0-9_]{1,64}$/.test(name);
}

function connectOpts(mysqlConfig, connectTimeoutMs, overrides) {
  return {
    host: mysqlConfig.host,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    port: mysqlConfig.port,
    ssl: mysqlConfig.ssl,
    connectTimeout: connectTimeoutMs,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ...overrides,
  };
}

// Optional: create the empty database before connecting (Railway often uses name `railway`).
async function ensureDatabaseExists(mysqlConfig, connectTimeoutMs) {
  const skip = process.env.MYSQL_AUTO_CREATE_DATABASE === "false" || process.env.MYSQL_AUTO_CREATE_DATABASE === "0";
  if (skip) return;

  const name = mysqlConfig.database;
  if (!isSafeDatabaseName(name)) {
    throw new Error("Invalid MYSQLDATABASE: use letters, numbers, underscores only (1–64 chars).");
  }

  const connection = await mysql.createConnection(
    connectOpts(mysqlConfig, connectTimeoutMs, { multipleStatements: false })
  );

  try {
    const sql =
      "CREATE DATABASE IF NOT EXISTS `" +
      name +
      "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
    await connection.query(sql);
    console.log("Database: " + name);
  } finally {
    await connection.end();
  }
}

async function runMigrations(mysqlConfig) {
  if (!mysqlConfig) return;

  const skip = process.env.SKIP_DB_MIGRATIONS === "1" || process.env.SKIP_DB_MIGRATIONS === "true";
  if (skip) {
    console.log("SKIP_DB_MIGRATIONS: skipping SQL migrations.");
    return;
  }

  const connectTimeoutMs = Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 60000);
  await ensureDatabaseExists(mysqlConfig, connectTimeoutMs);

  // Railway *.rlwy.net public proxy often closes long sessions — use a short connection per step.
  let conn = await mysql.createConnection(
    connectOpts(mysqlConfig, connectTimeoutMs, {
      database: mysqlConfig.database,
      multipleStatements: false,
    })
  );
  try {
    await conn.query(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
  } finally {
    await conn.end();
  }

  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter(function (f) {
      return f.endsWith(".sql");
    })
    .sort();

  for (let i = 0; i < sqlFiles.length; i++) {
    const fileName = sqlFiles[i];

    conn = await mysql.createConnection(
      connectOpts(mysqlConfig, connectTimeoutMs, {
        database: mysqlConfig.database,
        multipleStatements: false,
      })
    );
    let alreadyApplied = false;
    try {
      const [alreadyDone] = await conn.query(
        "SELECT 1 AS ok FROM schema_migrations WHERE name = ? LIMIT 1",
        [fileName]
      );
      alreadyApplied = alreadyDone.length > 0;
    } finally {
      await conn.end();
    }
    if (alreadyApplied) continue;

    const fullPath = path.join(migrationsDir, fileName);
    const fileSql = fs.readFileSync(fullPath, "utf8").trim();
    if (!fileSql) continue;

    console.log("→ " + fileName);
    conn = await mysql.createConnection(
      connectOpts(mysqlConfig, connectTimeoutMs, {
        database: mysqlConfig.database,
        multipleStatements: true,
      })
    );
    try {
      await conn.query(fileSql);
      await conn.execute("INSERT INTO schema_migrations (name) VALUES (?)", [fileName]);
    } finally {
      await conn.end();
    }
  }

  console.log("Migrations OK.");
}

module.exports = { runMigrations };
