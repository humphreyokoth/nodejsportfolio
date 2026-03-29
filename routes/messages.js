const { getPool } = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

function mountMessageRoutes(app) {
  app.get("/api/messages", requireAuth, async function (req, res) {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured." });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    try {
      const [[countRow]] = await db.execute("SELECT COUNT(*) AS total FROM contact_messages");
      const total = Number(countRow.total);
      const [rows] = await db.execute(
        `SELECT id, name, email, message, page_path, created_at
         FROM contact_messages
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      res.json({
        messages: rows,
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
      });
    } catch (err) {
      console.error("messages list:", err.message);
      res.status(500).json({ error: "Could not load messages." });
    }
  });

  app.delete("/api/messages/:id", requireAuth, async function (req, res) {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured." });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid id." });
    }

    try {
      const [result] = await db.execute("DELETE FROM contact_messages WHERE id = ?", [id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: "Not found." });
      res.json({ ok: true });
    } catch (err) {
      console.error("message delete:", err.message);
      res.status(500).json({ error: "Could not delete message." });
    }
  });
}

module.exports = { mountMessageRoutes };
