const bcrypt = require("bcrypt");
const { getMysqlConfig } = require("./mysqlConfig");
const { runMigrations } = require("./runMigrations");
const { getPool } = require("./pool");
const { isProd } = require("../lib/serverConfig");

function isDeferMigrations() {
  const flag = process.env.DEFER_MIGRATIONS;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return isProd || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

async function seedFirstAdminIfEmpty() {
  const db = getPool();
  if (!db) return;

  const username = process.env.INITIAL_ADMIN_USER || process.env.AUTH_BOOTSTRAP_USERNAME;
  const password = process.env.INITIAL_ADMIN_PASS || process.env.AUTH_BOOTSTRAP_PASSWORD;
  if (!username || !password) return;

  try {
    const [rows] = await db.execute("SELECT id FROM users LIMIT 1");
    if (rows.length > 0) return;

    const hash = await bcrypt.hash(password, 12);
    await db.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, hash]);
    console.log("First admin added. Remove INITIAL_ADMIN_PASS from env after login.");
  } catch (err) {
    console.error("Admin seed failed:", err.message);
  }
}

function isConnectionError(err) {
  const code = err && err.code;
  const msg = String((err && err.message) || "");
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ECONNPIPE" ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("Connection lost") ||
    msg.includes("server closed the connection")
  );
}

async function runMigrationsWithRetry(mysqlConfig) {
  const maxTries = Number(process.env.MYSQL_MIGRATION_RETRIES || 10);
  let lastError = null;

  for (let tryNum = 1; tryNum <= maxTries; tryNum++) {
    try {
      await runMigrations(mysqlConfig);
      if (tryNum > 1) console.log("Migrations OK on try " + tryNum + ".");
      return;
    } catch (err) {
      lastError = err;
      console.error("Migration " + tryNum + "/" + maxTries + ":", err.message);

      const canRetry = isConnectionError(err) && tryNum < maxTries;
      if (!canRetry) throw err;

      const waitMs = Math.min(4000 * tryNum, 25000);
      console.log("Retry MySQL in " + waitMs + "ms…");
      await new Promise(function (resolve) {
        setTimeout(resolve, waitMs);
      });
    }
  }

  throw lastError;
}

async function syncDatabase() {
  const mysqlConfig = getMysqlConfig();
  const skipMigrations =
    process.env.SKIP_DB_MIGRATIONS === "true" || process.env.SKIP_DB_MIGRATIONS === "1";

  if (skipMigrations) {
    console.log("SKIP_DB_MIGRATIONS: skipping migrations and admin seed (no DB at startup).");
    return;
  }

  if (!mysqlConfig) {
    return;
  }

  const defer = isDeferMigrations();
  const relax =
    process.env.RELAX_DB_STARTUP === "true" || process.env.RELAX_DB_STARTUP === "1";

  try {
    await runMigrationsWithRetry(mysqlConfig);
  } catch (err) {
    console.error("Migration failed:", err.message);

    if (!relax && !defer) {
      process.exit(1);
    }
    if (defer && !relax) {
      console.error("Migrations failed; server is running. Fix MySQL or set RELAX_DB_STARTUP=true.");
    }
    if (relax) {
      console.error("RELAX_DB_STARTUP: continuing without migrations.");
    }
  }

  await seedFirstAdminIfEmpty();
}

module.exports = { syncDatabase, isDeferMigrations };
