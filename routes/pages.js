const path = require("path");
const express = require("express");

const publicDir = path.join(__dirname, "..", "public");

function mountPageRoutes(app) {
  const html = (file) => (req, res) => res.sendFile(path.join(publicDir, file));
  app.get("/about", html("about.html"));
  app.get("/contact", html("contact.html"));
  app.get("/recipes", html("recipes.html"));
  app.use(express.static(publicDir));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    res.status(404).sendFile(path.join(publicDir, "404.html"));
  });
}

module.exports = { mountPageRoutes };
