const fs = require("fs");
const path = require("path");
const multer = require("multer");
const ExcelJS = require("exceljs");
const { getPool } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const {
  MEALS,
  MAX_TITLE,
  MAX_NOTES,
  MAX_IMAGE_URL,
  UPLOAD_REL,
} = require("../lib/constants");

const uploadFolder = path.join(__dirname, "..", "public", "uploads", "recipes");
fs.mkdirSync(uploadFolder, { recursive: true });

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, done) {
      done(null, uploadFolder);
    },
    filename: function (req, file, done) {
      const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 8);
      const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
      const safeExt = allowed ? ext : "";
      const name = Date.now() + "-" + Math.random().toString(36).slice(2, 12) + (safeExt || ".img");
      done(null, name);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, done) {
    const ok = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    if (ok) done(null, true);
    else done(new Error("Only JPEG, PNG, GIF, or WebP images."));
  },
});

function uploadMiddleware(req, res, next) {
  imageUpload.single("image")(req, res, function (err) {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Image max 5MB." });
    }
    return res.status(400).json({ error: err.message || "Invalid upload." });
  });
}

// Only delete files inside our upload folder (not external http URLs).
function deleteFileInUploadFolder(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return;
  if (!imageUrl.startsWith(UPLOAD_REL + "/")) return;

  const fileName = path.basename(imageUrl);
  if (!fileName || fileName.indexOf("..") !== -1) return;

  const fullPath = path.join(uploadFolder, fileName);
  if (!fullPath.startsWith(uploadFolder)) return;

  fs.unlink(fullPath, function () {});
}

function recipeFromRow(row) {
  return {
    id: String(row.id),
    mealType: row.meal_type,
    title: row.title,
    notes: row.notes || "",
    imageUrl: row.image_url || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function spreadsheetImageCell(siteUrl, imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const prefix = imageUrl.startsWith("/") ? "" : "/";
  return siteUrl + prefix + imageUrl;
}

async function writeXlsx(req, res, rows) {
  const siteUrl = req.protocol + "://" + (req.get("host") || "localhost");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Meals", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "Meal", key: "meal", width: 14 },
    { header: "Title", key: "title", width: 36 },
    { header: "Notes", key: "notes", width: 48 },
    { header: "Image", key: "image", width: 56 },
    { header: "Created", key: "created", width: 22 },
    { header: "Updated", key: "updated", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    sheet.addRow({
      meal: row.meal_type,
      title: row.title,
      notes: row.notes || "",
      image: spreadsheetImageCell(siteUrl, row.image_url || ""),
      created: row.created_at,
      updated: row.updated_at,
    });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="meals-' + dateStr + '.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
}

function mountRecipeRoutes(app) {
  app.get("/api/recipes", requireAuth, async function (req, res) {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured." });

    try {
      const [rows] = await db.execute(
        `SELECT id, meal_type, title, notes, image_url, created_at, updated_at
         FROM recipes WHERE user_id = ? ORDER BY created_at DESC`,
        [req.user.id]
      );
      const list = rows.map(recipeFromRow);
      res.json({ recipes: list });
    } catch (err) {
      console.error("recipes list:", err.message);
      res.status(500).json({ error: "Could not load meals." });
    }
  });

  app.get("/api/recipes/export.xlsx", requireAuth, async function (req, res) {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured." });

    try {
      const [rows] = await db.execute(
        `SELECT meal_type, title, notes, image_url, created_at, updated_at
         FROM recipes WHERE user_id = ? ORDER BY created_at DESC`,
        [req.user.id]
      );
      await writeXlsx(req, res, rows);
    } catch (err) {
      console.error("xlsx:", err.message);
      if (!res.headersSent) res.status(500).json({ error: "Export failed." });
    }
  });

  app.post("/api/recipes", requireAuth, uploadMiddleware, async function (req, res) {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured." });

    const mealType = String(req.body && req.body.mealType ? req.body.mealType : "breakfast")
      .trim()
      .toLowerCase();
    const title = String(req.body && req.body.title ? req.body.title : "").trim();
    const notes = String(req.body && req.body.notes ? req.body.notes : "")
      .trim()
      .slice(0, MAX_NOTES);
    const pastedImageUrl = String(req.body && req.body.imageUrl ? req.body.imageUrl : "")
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
      imageUrl = UPLOAD_REL + "/" + req.file.filename;
    } else if (pastedImageUrl && /^https?:\/\//i.test(pastedImageUrl)) {
      imageUrl = pastedImageUrl;
    }

    try {
      const [insertResult] = await db.execute(
        `INSERT INTO recipes (user_id, meal_type, title, notes, image_url) VALUES (?, ?, ?, ?, ?)`,
        [req.user.id, mealType, title, notes, imageUrl]
      );
      const newId = insertResult.insertId;
      const [saved] = await db.execute(
        "SELECT id, meal_type, title, notes, image_url, created_at, updated_at FROM recipes WHERE id = ?",
        [newId]
      );
      res.status(201).json({ recipe: recipeFromRow(saved[0]) });
    } catch (err) {
      console.error("recipe create:", err.message);
      if (req.file) deleteFileInUploadFolder(UPLOAD_REL + "/" + req.file.filename);
      res.status(500).json({ error: "Could not save meal." });
    }
  });

  app.patch("/api/recipes/:id", requireAuth, uploadMiddleware, async function (req, res) {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured." });

    const recipeId = Number(req.params.id);
    if (!Number.isInteger(recipeId) || recipeId <= 0) {
      return res.status(400).json({ error: "Invalid id." });
    }

    const body = req.body || {};
    const mealTypeIn =
      body.mealType !== undefined ? String(body.mealType).trim().toLowerCase() : undefined;
    const titleIn = body.title !== undefined ? String(body.title).trim() : undefined;
    const notesIn =
      body.notes !== undefined ? String(body.notes).trim().slice(0, MAX_NOTES) : undefined;
    const imageUrlIn =
      body.imageUrl !== undefined
        ? String(body.imageUrl || "").trim().slice(0, MAX_IMAGE_URL)
        : undefined;
    const userWantsClearImage = body.clearImage === "1" || body.clearImage === "true";

    if (mealTypeIn !== undefined && !MEALS.has(mealTypeIn)) {
      return res.status(400).json({ error: "Invalid meal type." });
    }
    if (titleIn !== undefined && (!titleIn || titleIn.length > MAX_TITLE)) {
      return res.status(400).json({ error: "Invalid title." });
    }

    try {
      const [found] = await db.execute(
        "SELECT id, meal_type, title, notes, image_url, created_at, updated_at FROM recipes WHERE id = ? AND user_id = ?",
        [recipeId, req.user.id]
      );
      if (found.length === 0) {
        if (req.file) deleteFileInUploadFolder(UPLOAD_REL + "/" + req.file.filename);
        return res.status(404).json({ error: "Not found." });
      }

      const current = found[0];
      let nextMeal = mealTypeIn !== undefined ? mealTypeIn : current.meal_type;
      let nextTitle = titleIn !== undefined ? titleIn : current.title;
      let nextNotes = notesIn !== undefined ? notesIn : current.notes;
      let nextImage = current.image_url;

      if (userWantsClearImage) {
        deleteFileInUploadFolder(nextImage);
        nextImage = null;
      }

      if (req.file) {
        deleteFileInUploadFolder(current.image_url);
        nextImage = UPLOAD_REL + "/" + req.file.filename;
      } else if (imageUrlIn !== undefined && imageUrlIn !== "") {
        if (!/^https?:\/\//i.test(imageUrlIn)) {
          return res.status(400).json({ error: "Image URL must be http(s)." });
        }
        deleteFileInUploadFolder(current.image_url);
        nextImage = imageUrlIn;
      }

      const noFieldChanged =
        mealTypeIn === undefined &&
        titleIn === undefined &&
        notesIn === undefined &&
        !userWantsClearImage &&
        !req.file &&
        imageUrlIn === undefined;
      if (noFieldChanged) {
        return res.status(400).json({ error: "Nothing to update." });
      }

      await db.execute(
        `UPDATE recipes SET meal_type = ?, title = ?, notes = ?, image_url = ? WHERE id = ? AND user_id = ?`,
        [nextMeal, nextTitle, nextNotes, nextImage, recipeId, req.user.id]
      );

      const [updated] = await db.execute(
        "SELECT id, meal_type, title, notes, image_url, created_at, updated_at FROM recipes WHERE id = ?",
        [recipeId]
      );
      res.json({ recipe: recipeFromRow(updated[0]) });
    } catch (err) {
      console.error("recipe patch:", err.message);
      if (req.file) deleteFileInUploadFolder(UPLOAD_REL + "/" + req.file.filename);
      res.status(500).json({ error: "Could not update meal." });
    }
  });

  app.delete("/api/recipes/:id", requireAuth, async function (req, res) {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured." });

    const recipeId = Number(req.params.id);
    if (!Number.isInteger(recipeId) || recipeId <= 0) {
      return res.status(400).json({ error: "Invalid id." });
    }

    try {
      const [before] = await db.execute(
        "SELECT image_url FROM recipes WHERE id = ? AND user_id = ?",
        [recipeId, req.user.id]
      );
      const [delResult] = await db.execute("DELETE FROM recipes WHERE id = ? AND user_id = ?", [
        recipeId,
        req.user.id,
      ]);
      if (delResult.affectedRows === 0) {
        return res.status(404).json({ error: "Not found." });
      }
      if (before[0] && before[0].image_url) {
        deleteFileInUploadFolder(before[0].image_url);
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("recipe delete:", err.message);
      res.status(500).json({ error: "Could not delete meal." });
    }
  });
}

module.exports = { mountRecipeRoutes };
