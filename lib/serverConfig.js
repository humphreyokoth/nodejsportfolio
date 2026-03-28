require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";
let n = Number(process.env.PORT);
if (n === 3306) n = 7000;
const PORT = Number.isFinite(n) && n > 0 ? n : 7000;

const JWT_SECRET =
  process.env.JWT_SECRET || (!isProd ? "dev-only-change-me-not-for-production" : null);
if (isProd && !JWT_SECRET) {
  console.error("FATAL: Set JWT_SECRET in production.");
  process.exit(1);
}

const COOKIE_NAME = "portfolio_token";

module.exports = { isProd, PORT, JWT_SECRET, COOKIE_NAME };
