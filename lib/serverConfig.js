require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";
const fromEnv = Number(process.env.PORT);
let PORT =
  Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 7000;
// Public Networking target port must match. Railway often sets PORT to another value — on Railway we always use 7000 (your Networking tab).
if (process.env.RAILWAY_ENVIRONMENT) {
  PORT = 7000;
}

const JWT_SECRET =
  process.env.JWT_SECRET || (!isProd ? "dev-only-change-me-not-for-production" : null);
if (isProd && !JWT_SECRET) {
  console.error("FATAL: Set JWT_SECRET in production.");
  process.exit(1);
}

const COOKIE_NAME = "portfolio_token";

module.exports = { isProd, PORT, JWT_SECRET, COOKIE_NAME };
