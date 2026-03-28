const { getPool } = require("../db/pool");
const { notifyContactForm } = require("../lib/mail");
const {
  MAX_NAME,
  MAX_EMAIL,
  MAX_MESSAGE,
  MAX_USER_AGENT,
  MAX_PAGE_PATH,
} = require("../lib/constants");

function mountContactRoutes(app) {
  app.post("/api/contact", async function (req, res) {
    const db = getPool();
    if (!db) {
      return res.status(503).json({ error: "Database not configured (MySQL env vars)." });
    }

    const body = req.body || {};
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    const userAgent = String(body.userAgent || "").slice(0, MAX_USER_AGENT) || null;
    const pagePath = String(body.page || "").slice(0, MAX_PAGE_PATH) || null;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email, and message required." });
    }

    const nameTooLong = name.length > MAX_NAME;
    const emailTooLong = email.length > MAX_EMAIL;
    const messageTooLong = message.length > MAX_MESSAGE;
    if (nameTooLong || emailTooLong || messageTooLong) {
      return res.status(400).json({ error: "A field is too long." });
    }

    try {
      await db.execute(
        `INSERT INTO contact_messages (name, email, message, user_agent, page_path)
         VALUES (?, ?, ?, ?, ?)`,
        [name, email, message, userAgent, pagePath]
      );

      notifyContactForm({ name: name, email: email, message: message, pagePath: pagePath }).catch(
        function (mailErr) {
          console.error("contact mail:", mailErr.message);
        }
      );

      res.status(201).json({ ok: true });
    } catch (err) {
      console.error("contact:", err.message);
      res.status(500).json({ error: "Could not save message." });
    }
  });
}

module.exports = { mountContactRoutes };
