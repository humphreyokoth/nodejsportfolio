require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const ExcelJS = require("exceljs");
const { getMysqlConfig } = require("./db/mysqlConfig");
const { runMigrations } = require("./db/runMigrations");
const { notifyContactForm } = require("./lib/mail");

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";
const JWT_SECRET =
  process.env.JWT_SECRET || (!isProd ? "dev-only-change-me-not-for-production" : null);
const COOKIE_NAME = "portfolio_token";

const MAX_NAME = 255;
const MAX_EMAIL = 320;
const MAX_MESSAGE = 10000;
const MAX_USER_AGENT = 512;
const MAX_PAGE_PATH = 512;
const MAX_USERNAME = 64;
const MAX_TITLE = 500;
const MAX_NOTES = 8000;
const MAX_IMAGE_URL = 2048;
const MEALS = new Set(["breakfast", "lunch", "dinner"]);
const UPLOAD_REL = "/uploads/recipes";
const uploadAbs = path.join(__dirname, "public", "uploads", "recipes");
fs.mkdirSync(uploadAbs, { recursive: true });

const recipeImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadAbs),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 8);
      const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const safeExt = allowed.includes(ext) ? ext : "";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 12)}${safeExt || ".img"}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, GIF, or WebP images are allowed."));
  },
});

function recipeUploadMiddleware(req, res, next) {
  recipeImageUpload.single("image")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Image must be 5MB or smaller." });
    }
    return res.status(400).json({ error: err.message || "Invalid upload." });
  });
}

function deleteLocalRecipeImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith(`${UPLOAD_REL}/`)) return;
  const base = path.basename(imageUrl);
  if (!base || base.includes("..")) return;
  const full = path.join(uploadAbs, base);
  if (!full.startsWith(uploadAbs)) return;
  fs.unlink(full, () => {});
}

function rowToRecipe(r) {
  return {
    id: String(r.id),
    mealType: r.meal_type,
    title: r.title,
    notes: r.notes || "",
    imageUrl: r.image_url || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

if (isProd && !JWT_SECRET) {
  console.error("FATAL: set JWT_SECRET in production (e.g. in Railway variables).");
  process.exit(1);
}

let pool = null;

function getPool() {
  if (pool) return pool;
  const c = getMysqlConfig();
  if (!c) {
    return null;
  }
  pool = mysql.createPool({
    host: c.host,
    user: c.user,
    password: c.password,
    database: c.database,
    port: c.port,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    ssl: c.ssl,
  });
  return pool;
}

async function ensureBootstrapUser() {
  const db = getPool();
  if (!db) return;
  const user = process.env.AUTH_BOOTSTRAP_USERNAME;
  const pass = process.env.AUTH_BOOTSTRAP_PASSWORD;
  if (!user || !pass) return;
  try {
    const [rows] = await db.execute("SELECT id FROM users LIMIT 1");
    if (rows.length > 0) return;
    const hash = await bcrypt.hash(pass, 12);
    await db.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", [user, hash]);
    console.log("Bootstrap user created (remove AUTH_BOOTSTRAP_PASSWORD after deploy).");
  } catch (e) {
    console.error("Bootstrap user error:", e.message);
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function readAuth(req) {
  const fromCookie = req.cookies[COOKIE_NAME];
  const authHeader = req.headers.authorization;
  const fromBearer =
    authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const token = fromCookie || fromBearer;
  if (!token) return null;
  try {
    const p = jwt.verify(token, JWT_SECRET);
    return { id: Number(p.sub), username: p.u };
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const u = readAuth(req);
  if (!u || !u.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.user = u;
  next();
}

app.use(express.json({ limit: "128kb" }));
app.use(express.urlencoded({ extended: true, limit: "128kb" }));
app.use(cookieParser());

const allowedOriginsList = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function applyCors(req, res) {
  if (allowedOriginsList.length === 0) return;
  const origin = req.headers.origin;
  if (origin && allowedOriginsList.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
}

app.use((req, res, next) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const u = readAuth(req);
  if (!u) return res.status(401).json({ error: "Not authenticated" });
  res.json({ user: { username: u.username } });
});

app.post("/api/auth/login", async (req, res) => {
  const db = getPool();
  if (!db) {
    return res.status(503).json({ error: "Database not configured." });
  }
  const username = String(req.body?.username || "").trim().slice(0, MAX_USERNAME);
  const password = String(req.body?.password || "");
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }
  try {
    const [rows] = await db.execute(
      "SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1",
      [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    const row = rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    const token = jwt.sign({ sub: String(row.id), u: row.username }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json({ ok: true, user: { username: row.username }, token });
  } catch (e) {
    console.error("login error:", e.message);
    res.status(500).json({ error: "Login failed." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });
  res.json({ ok: true });
});

app.get("/api/recipes", requireAuth, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database not configured." });
  try {
    const [rows] = await db.execute(
      `SELECT id, meal_type, title, notes, image_url, created_at, updated_at
       FROM recipes WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    const list = rows.map(rowToRecipe);
    res.json({ recipes: list });
  } catch (e) {
    console.error("recipes list:", e.message);
    res.status(500).json({ error: "Could not load meals." });
  }
});

app.get("/api/recipes/export.xlsx", requireAuth, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database not configured." });
  try {
    const [rows] = await db.execute(
      `SELECT meal_type, title, notes, image_url, created_at, updated_at
       FROM recipes WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    const hostBase = `${req.protocol}://${req.get("host") || "localhost"}`;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Meals dashboard";
    const sheet = wb.addWorksheet("Meals", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = [
      { header: "Meal", key: "meal", width: 14 },
      { header: "Title", key: "title", width: 36 },
      { header: "Notes", key: "notes", width: 48 },
      { header: "Image (link)", key: "image", width: 56 },
      { header: "Created", key: "created", width: 22 },
      { header: "Updated", key: "updated", width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const r of rows) {
      let imageCell = r.image_url || "";
      if (imageCell && !/^https?:\/\//i.test(imageCell)) {
        imageCell = `${hostBase}${imageCell.startsWith("/") ? "" : "/"}${imageCell}`;
      }
      sheet.addRow({
        meal: r.meal_type,
        title: r.title,
        notes: r.notes || "",
        image: imageCell,
        created: r.created_at,
        updated: r.updated_at,
      });
    }
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="meals-export-${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("excel export:", e.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Could not build export." });
    }
  }
});

app.post("/api/recipes", requireAuth, recipeUploadMiddleware, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database not configured." });
  const mealType = String(req.body?.mealType || "breakfast").trim().toLowerCase();
  const title = String(req.body?.title || "").trim();
  const notes = String(req.body?.notes || "").trim().slice(0, MAX_NOTES);
  const imageUrlField = String(req.body?.imageUrl || "")
    .trim()
    .slice(0, MAX_IMAGE_URL);
  if (!MEALS.has(mealType)) {
    return res.status(400).json({ error: "Invalid meal type." });
  }
  if (!title || title.length > MAX_TITLE) {
    return res.status(400).json({ error: "Title required." });
  }
  let imageUrl = null;
  if (req.file) {
    imageUrl = `${UPLOAD_REL}/${req.file.filename}`;
  } else if (imageUrlField && /^https?:\/\//i.test(imageUrlField)) {
    imageUrl = imageUrlField;
  }
  try {
    const [result] = await db.execute(
      `INSERT INTO recipes (user_id, meal_type, title, notes, image_url) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, mealType, title, notes, imageUrl]
    );
    const id = result.insertId;
    const [out] = await db.execute(
      "SELECT id, meal_type, title, notes, image_url, created_at, updated_at FROM recipes WHERE id = ?",
      [id]
    );
    res.status(201).json({ recipe: rowToRecipe(out[0]) });
  } catch (e) {
    console.error("recipe create:", e.message);
    if (req.file) deleteLocalRecipeImage(`${UPLOAD_REL}/${req.file.filename}`);
    res.status(500).json({ error: "Could not save meal." });
  }
});

app.patch("/api/recipes/:id", requireAuth, recipeUploadMiddleware, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database not configured." });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id." });
  }
  const body = req.body || {};
  const mealType =
    body.mealType !== undefined
      ? String(body.mealType).trim().toLowerCase()
      : undefined;
  const title = body.title !== undefined ? String(body.title).trim() : undefined;
  const notes = body.notes !== undefined ? String(body.notes).trim().slice(0, MAX_NOTES) : undefined;
  const imageUrlField =
    body.imageUrl !== undefined
      ? String(body.imageUrl || "")
          .trim()
          .slice(0, MAX_IMAGE_URL)
      : undefined;
  const clearImage = body.clearImage === "1" || body.clearImage === "true";

  if (mealType !== undefined && !MEALS.has(mealType)) {
    return res.status(400).json({ error: "Invalid meal type." });
  }
  if (title !== undefined && (!title || title.length > MAX_TITLE)) {
    return res.status(400).json({ error: "Invalid title." });
  }

  try {
    const [rows] = await db.execute(
      "SELECT id, meal_type, title, notes, image_url, created_at, updated_at FROM recipes WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );
    if (rows.length === 0) {
      if (req.file) deleteLocalRecipeImage(`${UPLOAD_REL}/${req.file.filename}`);
      return res.status(404).json({ error: "Not found." });
    }
    const cur = rows[0];
    const nextMeal = mealType ?? cur.meal_type;
    const nextTitle = title ?? cur.title;
    const nextNotes = notes !== undefined ? notes : cur.notes;

    let nextImage = cur.image_url;
    if (clearImage) {
      deleteLocalRecipeImage(nextImage);
      nextImage = null;
    }
    if (req.file) {
      deleteLocalRecipeImage(cur.image_url);
      nextImage = `${UPLOAD_REL}/${req.file.filename}`;
    } else if (imageUrlField !== undefined && imageUrlField !== "") {
      if (!/^https?:\/\//i.test(imageUrlField)) {
        return res.status(400).json({ error: "Image URL must start with http:// or https://" });
      }
      deleteLocalRecipeImage(cur.image_url);
      nextImage = imageUrlField;
    }

    if (
      mealType === undefined &&
      title === undefined &&
      notes === undefined &&
      !clearImage &&
      !req.file &&
      imageUrlField === undefined
    ) {
      if (req.file) deleteLocalRecipeImage(`${UPLOAD_REL}/${req.file.filename}`);
      return res.status(400).json({ error: "Nothing to update." });
    }

    await db.execute(
      `UPDATE recipes SET meal_type = ?, title = ?, notes = ?, image_url = ? WHERE id = ? AND user_id = ?`,
      [nextMeal, nextTitle, nextNotes, nextImage, id, req.user.id]
    );

    const [out] = await db.execute(
      "SELECT id, meal_type, title, notes, image_url, created_at, updated_at FROM recipes WHERE id = ?",
      [id]
    );
    res.json({ recipe: rowToRecipe(out[0]) });
  } catch (e) {
    console.error("recipe patch:", e.message);
    if (req.file) deleteLocalRecipeImage(`${UPLOAD_REL}/${req.file.filename}`);
    res.status(500).json({ error: "Could not update meal." });
  }
});

app.delete("/api/recipes/:id", requireAuth, async (req, res) => {
  const db = getPool();
  if (!db) return res.status(503).json({ error: "Database not configured." });
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id." });
  }
  try {
    const [existing] = await db.execute(
      "SELECT image_url FROM recipes WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );
    const [result] = await db.execute("DELETE FROM recipes WHERE id = ? AND user_id = ?", [
      id,
      req.user.id,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Not found." });
    }
    if (existing[0]?.image_url) deleteLocalRecipeImage(existing[0].image_url);
    res.json({ ok: true });
  } catch (e) {
    console.error("recipe delete:", e.message);
    res.status(500).json({ error: "Could not delete meal." });
  }
});

app.post("/api/contact", async (req, res) => {
  const db = getPool();
  if (!db) {
    return res.status(503).json({
      error:
        "Database is not configured. Set MYSQLHOST (or MYSQL_HOST), MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQLPORT.",
    });
  }

  const body = req.body || {};
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const message = String(body.message || "").trim();
  const userAgent = String(body.userAgent || "").slice(0, MAX_USER_AGENT) || null;
  const pagePath = String(body.page || "").slice(0, MAX_PAGE_PATH) || null;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }
  if (name.length > MAX_NAME || email.length > MAX_EMAIL || message.length > MAX_MESSAGE) {
    return res.status(400).json({ error: "One or more fields are too long." });
  }

  try {
    await db.execute(
      `INSERT INTO contact_messages (name, email, message, user_agent, page_path)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, message, userAgent, pagePath]
    );
    notifyContactForm({ name, email, message, pagePath }).catch((e) =>
      console.error("contact email notify:", e.message)
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("contact insert error:", err.message);
    return res.status(500).json({ error: "Could not save your message. Try again later." });
  }
});

function sendPublicHtml(file) {
  return (req, res) => {
    res.sendFile(path.join(__dirname, "public", file));
  };
}

app.get("/about", sendPublicHtml("about.html"));
app.get("/contact", sendPublicHtml("contact.html"));
app.get("/recipes", sendPublicHtml("recipes.html"));

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

async function boot() {
  const cfg = getMysqlConfig();
  if (cfg) {
    try {
      await runMigrations(cfg);
    } catch (e) {
      console.error("Migration failed:", e.message);
      process.exit(1);
    }
  }
  await ensureBootstrapUser();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

boot().catch((e) => {
  console.error(e);
  process.exit(1);
});
