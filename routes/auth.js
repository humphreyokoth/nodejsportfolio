const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getPool } = require("../db/pool");
const { readAuth, cookieOptions, COOKIE_NAME, JWT_SECRET } = require("../middleware/auth");
const { isProd } = require("../lib/serverConfig");
const { MAX_USERNAME } = require("../lib/constants");

function signSessionToken(userId, username) {
  return jwt.sign({ sub: String(userId), u: username }, JWT_SECRET, { expiresIn: "7d" });
}

function mountAuthRoutes(app) {
  app.get("/api/auth/me", function (req, res) {
    const user = readAuth(req);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({ user: { username: user.username } });
  });

  app.post("/api/auth/register", async function (req, res) {
    const db = getPool();
    if (!db) {
      return res.status(503).json({ error: "Database not configured." });
    }

    const username = String(req.body && req.body.username ? req.body.username : "")
      .trim()
      .slice(0, MAX_USERNAME);
    const password = String(req.body && req.body.password ? req.body.password : "");

    if (username.length < 2) {
      return res.status(400).json({ error: "Username must be at least 2 characters." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const allowOpenRegistration =
      process.env.AUTH_ALLOW_REGISTER === "true" || process.env.AUTH_ALLOW_REGISTER === "1";

    try {
      if (!allowOpenRegistration) {
        const [countRows] = await db.execute("SELECT COUNT(*) AS n FROM users");
        const userCount = Number(countRows[0].n);
        if (userCount > 0) {
          return res.status(403).json({
            error: "Registration closed. Use AUTH_ALLOW_REGISTER=true or ask an admin.",
          });
        }
      }

      const [existing] = await db.execute("SELECT id FROM users WHERE username = ? LIMIT 1", [
        username,
      ]);
      if (existing.length > 0) {
        return res.status(409).json({ error: "Username taken." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await db.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", [
        username,
        passwordHash,
      ]);

      const [newUserRows] = await db.execute(
        "SELECT id, username FROM users WHERE username = ? LIMIT 1",
        [username]
      );
      const newUser = newUserRows[0];
      const token = signSessionToken(newUser.id, newUser.username);

      res.cookie(COOKIE_NAME, token, cookieOptions());
      res.status(201).json({ ok: true, user: { username: newUser.username }, token: token });
    } catch (err) {
      console.error("register:", err.message);
      res.status(500).json({ error: "Could not create account." });
    }
  });

  app.post("/api/auth/login", async function (req, res) {
    const db = getPool();
    if (!db) {
      return res.status(503).json({ error: "Database not configured." });
    }

    const username = String(req.body && req.body.username ? req.body.username : "")
      .trim()
      .slice(0, MAX_USERNAME);
    const password = String(req.body && req.body.password ? req.body.password : "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required." });
    }

    try {
      const [users] = await db.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1",
        [username]
      );
      if (users.length === 0) {
        return res.status(401).json({ error: "Invalid credentials." });
      }

      const row = users[0];
      const passwordOk = await bcrypt.compare(password, row.password_hash);
      if (!passwordOk) {
        return res.status(401).json({ error: "Invalid credentials." });
      }

      const token = signSessionToken(row.id, row.username);
      res.cookie(COOKIE_NAME, token, cookieOptions());
      res.json({ ok: true, user: { username: row.username }, token: token });
    } catch (err) {
      console.error("login:", err.message);
      res.status(500).json({ error: "Login failed." });
    }
  });

  app.post("/api/auth/logout", function (req, res) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
    });
    res.json({ ok: true });
  });
}

module.exports = { mountAuthRoutes };
