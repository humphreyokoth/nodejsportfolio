/**
 * Prints public Railway URLs for services in the linked project.
 * Run from repo root: npm run railway:api-url
 * Requires: railway CLI logged in (`railway login`) and `railway link` in this folder.
 */

const { execSync } = require("child_process");
const path = require("path");
const https = require("https");

const root = path.join(__dirname, "..");

function httpsGet(url, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.on("data", (c) => {
        body += c;
      });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

function walkServiceInstances(data) {
  const out = [];
  const envEdges = data?.environments?.edges || [];
  for (const envEdge of envEdges) {
    const env = envEdge?.node;
    const siEdges = env?.serviceInstances?.edges || [];
    for (const siEdge of siEdges) {
      const n = siEdge?.node;
      if (!n) continue;
      const name = n.serviceName || "(unnamed)";
      const image = n.source?.image || "";
      const repo = n.source?.repo;
      const domains = (n.domains?.serviceDomains || []).map((d) => d.domain).filter(Boolean);
      const isMysql =
        /mysql/i.test(image) || /^mysql$/i.test(name.trim());
      out.push({ name, image, repo, domains, isMysql });
    }
  }
  return out;
}

async function main() {
  let raw;
  try {
    raw = execSync("railway status --json", {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    console.error("Could not run `railway status --json`.");
    console.error("  1. railway login");
    console.error("  2. cd to this repo and run: railway link");
    console.error(e.stderr?.toString() || e.message);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("Invalid JSON from railway status --json");
    process.exit(1);
  }

  const project = data.name || data.id || "project";
  console.log(`Linked project: ${project}\n`);

  const instances = walkServiceInstances(data);
  if (instances.length === 0) {
    console.log("No services found in this environment.");
    process.exit(0);
  }

  const webCandidates = instances.filter((s) => !s.isMysql && s.domains.length > 0);
  const mysqlPublic = instances.filter((s) => s.isMysql && s.domains.length > 0);

  for (const s of instances) {
    const kind = s.isMysql ? "MySQL (database)" : "App / other";
    console.log(`Service: ${s.name}  [${kind}]`);
    if (s.repo) console.log(`  Source repo: ${s.repo}`);
    if (s.image) console.log(`  Image: ${s.image}`);
    if (s.domains.length === 0) {
      console.log("  Public URL: (none — open service → Settings → Networking → Generate domain)");
    } else {
      for (const d of s.domains) {
        const base = `https://${d}`.replace(/\/$/, "");
        console.log(`  Public URL: ${base}`);
      }
    }
    console.log("");
  }

  if (mysqlPublic.length > 0) {
    console.log(
      "Warning: Do not put a MySQL service URL in public/js/api-config.js. The browser must use your Node Web service URL.\n"
    );
  }

  if (webCandidates.length === 1) {
    const d = webCandidates[0].domains[0];
    const base = `https://${d}`.replace(/\/$/, "");
    console.log("---");
    console.log("Use this for public/js/api-config.js → API_BASE:");
    console.log(`  export const API_BASE = "${base}";`);
    console.log("");
    const health = `${base}/api/health`;
    console.log("Checking:", health);
    const res = await httpsGet(health);
    if (res && res.status === 200 && res.body.includes('"ok"')) {
      console.log("  OK: health endpoint returned success.");
    } else if (res) {
      console.log(`  HTTP ${res.status} — fix Web deploy (JWT_SECRET, MySQL vars, logs).`);
    } else {
      console.log("  (could not reach URL — deploy still building or service asleep?)");
    }
  } else if (webCandidates.length === 0) {
    console.log("---");
    console.log("No non-MySQL service with a public URL was found.");
    console.log("Add your Node app on Railway:");
    console.log("  Dashboard: same project → New → GitHub Repo → pick nodejsportfolio (this repo).");
    console.log("  Or CLI (after railway login): railway add -r humphreyokoth/nodejsportfolio -s portfolio-web");
    console.log("Then: Settings → Networking → generate domain, copy https URL into api-config.js.");
  } else {
    console.log("---");
    console.log("Multiple app URLs found — pick the service that runs node server.js / npm start.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
