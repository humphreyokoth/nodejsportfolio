require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";
const n = Number(process.env.PORT);
const PORT = Number.isFinite(n) && n > 0 ? n : 7000;
if (process.env.RAILWAY_ENVIRONMENT && PORT === 3306) {
  console.error("FATAL: Do not set PORT=3306 on Railway Web (that is MySQL).");
  process.exit(1);
}

const JWT_SECRET =
  process.env.JWT_SECRET || (!isProd ? "dev-only-change-me-not-for-production" : null);
if (isProd && !JWT_SECRET) {
  console.error("FATAL: Set JWT_SECRET in production.");
  process.exit(1);
}

const COOKIE_NAME = "portfolio_token";

module.exports = { isProd, PORT, JWT_SECRET, COOKIE_NAME };
