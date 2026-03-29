const { PORT } = require("./lib/serverConfig");
const express = require("express");
const cookieParser = require("cookie-parser");
const { corsMiddleware } = require("./middleware/cors");
const { mountAuthRoutes } = require("./routes/auth");
const { mountRecipeRoutes } = require("./routes/recipes");
const { mountContactRoutes } = require("./routes/contact");
const { mountMessageRoutes } = require("./routes/messages");
const { mountPageRoutes } = require("./routes/pages");
const { syncDatabase, isDeferMigrations } = require("./db/startupSync");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(corsMiddleware);

app.get("/api/health", (req, res) => res.json({ ok: true }));
mountAuthRoutes(app);
mountRecipeRoutes(app);
mountContactRoutes(app);
mountMessageRoutes(app);
mountPageRoutes(app);

async function start() {
  const deferDb = isDeferMigrations();

  if (!deferDb) {
    await syncDatabase();
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log("Listening on " + PORT);
    if (deferDb) {
      syncDatabase().catch((err) => console.error("DB sync:", err.message));
    }
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
