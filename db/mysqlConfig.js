/**
 * Supports:
 * - Railway names: MYSQLHOST, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQLPORT
 * - Underscore names: MYSQL_HOST, etc.
 * - Single URL: MYSQL_URL / DATABASE_URL first (internal on Railway), then MYSQL_PUBLIC_URL
 *   (public proxy is for your laptop; inside Railway use mysql.railway.internal / MYSQL_URL).
 */

function parseMysqlUrl(str) {
  if (!str || typeof str !== "string" || !str.toLowerCase().startsWith("mysql://")) {
    return null;
  }
  try {
    const normalized = str.replace(/^mysql:\/\//i, "http://");
    const u = new URL(normalized);
    const user = decodeURIComponent(u.username || "");
    const password = decodeURIComponent(u.password || "");
    const host = u.hostname;
    const port = u.port ? Number(u.port) : 3306;
    const database = (u.pathname || "").replace(/^\//, "").split("/")[0];
    if (!host || !user || !database) {
      return null;
    }
    return { host, port, user, password, database };
  } catch {
    return null;
  }
}

/**
 * Railway public proxy (*.rlwy.net) often presents a chain Node does not trust →
 * "self-signed certificate in certificate chain". Use rejectUnauthorized: false unless strict.
 */
function mysqlSslFromEnv(host) {
  if (process.env.MYSQL_SSL === "false" || process.env.MYSQL_SSL === "0") {
    return false;
  }
  const h = host || "";
  if (h.endsWith(".internal") || h.includes(".railway.internal")) {
    return false;
  }

  let enable = false;
  if (process.env.MYSQL_SSL === "true" || process.env.MYSQL_SSL === "1") {
    enable = true;
  } else if (h.includes("rlwy.net")) {
    enable = true;
  } else if (process.env.NODE_ENV === "production") {
    enable = true;
  }

  if (!enable) {
    return false;
  }

  const strict =
    process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === "true" ||
    process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === "1";

  if (strict) {
    return {};
  }
  if (h.includes("rlwy.net")) {
    return { rejectUnauthorized: false };
  }
  const relaxed =
    process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === "false" ||
    process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === "0";
  if (relaxed) {
    return { rejectUnauthorized: false };
  }
  return {};
}

function getMysqlConfig() {
  const fromUrl = parseMysqlUrl(
    process.env.MYSQL_URL ||
      process.env.DATABASE_URL ||
      process.env.MYSQL_PUBLIC_URL ||
      ""
  );

  const host =
    process.env.MYSQL_HOST || process.env.MYSQLHOST || fromUrl?.host;
  const user =
    process.env.MYSQL_USER || process.env.MYSQLUSER || fromUrl?.user;
  const password =
    process.env.MYSQLPASSWORD ?? process.env.MYSQL_PASSWORD ?? fromUrl?.password;
  const database =
    process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || fromUrl?.database;
  const port = Number(
    process.env.MYSQL_PORT || process.env.MYSQLPORT || fromUrl?.port || 3306
  );

  if (!host || !user || password === undefined || !database) {
    return null;
  }
  return {
    host,
    user,
    password,
    database,
    port,
    ssl: mysqlSslFromEnv(host),
  };
}

module.exports = { getMysqlConfig, mysqlSslFromEnv, parseMysqlUrl };
