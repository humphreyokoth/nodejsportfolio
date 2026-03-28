const jwt = require("jsonwebtoken");
const { JWT_SECRET, COOKIE_NAME, isProd } = require("../lib/serverConfig");

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_WEEK_MS,
  };
}

function getTokenString(req) {
  const fromCookie = req.cookies[COOKIE_NAME];
  if (fromCookie) return fromCookie;

  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function readAuth(req) {
  const tokenString = getTokenString(req);
  if (!tokenString) return null;

  try {
    const decoded = jwt.verify(tokenString, JWT_SECRET);
    const userId = Number(decoded.sub);
    const username = decoded.u;
    return { id: userId, username: username };
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = readAuth(req);
  if (!user || !user.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.user = user;
  next();
}

module.exports = { readAuth, requireAuth, cookieOptions, COOKIE_NAME, JWT_SECRET };
