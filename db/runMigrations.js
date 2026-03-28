const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function runMigrations(config) {
  if (!config) return;
  if (process.env.SKIP_DB_MIGRATIONS === "1" || process.env.SKIP_DB_MIGRATIONS === "true") {
    console.log("SKIP_DB_MIGRATIONS set: skipping SQL migrations.");
    return;
  }

  const conn = await mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    port: config.port,
    ssl: config.ssl,
    multipleStatements: true,
  });

  try {
    await conn.query(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

    const dir = path.join(__dirname, "migrations");
    if (!fs.existsSync(dir)) {
      return;
    }

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const [done] = await conn.query(
        "SELECT 1 AS ok FROM schema_migrations WHERE name = ? LIMIT 1",
        [file]
      );
      if (done.length > 0) {
        continue;
      }

      const fullPath = path.join(dir, file);
      const sql = fs.readFileSync(fullPath, "utf8").trim();
      if (!sql) {
        continue;
      }

      console.log(`Migration: applying ${file}`);
      await conn.query(sql);
      await conn.execute("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
    }

    console.log("Migrations finished.");
  } finally {
    await conn.end();
  }
}

module.exports = { runMigrations };
