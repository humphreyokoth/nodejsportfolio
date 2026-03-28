# Portfolio (Node + MySQL + Firebase Hosting)

**Pieces:** Node API in this repo (`server.js`, `routes/`, `db/`). Static site in `public/`. API URL is set in `public/js/api-config.js` as `API_BASE`.

---

## Run locally

1. Copy env: use `.env` (see `railway-web-env.template` for names). Set at least MySQL (`MYSQL_*` or `MYSQL_PUBLIC_URL`), `JWT_SECRET`, and optional `INITIAL_ADMIN_USER` / `INITIAL_ADMIN_PASS`. Use **`PORT=7000`** (or omit `PORT` to default to **7000**).
2. `npm install`
3. `npm start` (or `npm run dev` with nodemon)
4. Open **http://127.0.0.1:7000** (or your `PORT`). Health: **http://127.0.0.1:7000/api/health** → `{"ok":true}`.

SQL migrations run when the server starts unless you set `SKIP_DB_MIGRATIONS=true`.

---

## Railway (API + MySQL)

1. Create a project, add the **MySQL** plugin, then add this repo as a **Web** service in the **same** project.
2. In the **Web** service variables: connect MySQL (Railway fills `MYSQL_URL` / related vars), set `JWT_SECRET`, `ALLOWED_ORIGINS`, `INITIAL_ADMIN_USER`, `INITIAL_ADMIN_PASS`.
3. **Do not** set `PORT` to **3306** — that is MySQL’s port. On the **Web** service set **`PORT=7000`** and point public networking at **7000** (same as local).
4. After deploy, test: `https://<your-service>.up.railway.app/api/health` → `{"ok":true}`.

---

## Firebase (host the `public/` site)

End-to-end: Railway serves `/api/*`; Firebase only serves static files. **Contact** and **Meals** use `API_BASE` from `public/js/api-config.js` so the browser calls Railway directly.

1. Deploy the API on Railway and confirm `https://<your-service>.up.railway.app/api/health` returns `{"ok":true}`.
2. In `public/js/api-config.js`, set `API_BASE` to that same origin (no trailing slash). On the Web service, set `ALLOWED_ORIGINS` to include your Firebase site URL (e.g. `https://yourproject.web.app`).
3. `npx firebase login`
4. `npx firebase deploy --only hosting`

---

## Commands

| Command | What it does |
|--------|----------------|
| `npm start` | Run the API locally |
| `npm run migrate` | Run SQL migrations once (`db/migrate-cli.js`) |
| `npx firebase deploy --only hosting` | Upload `public/` to Firebase Hosting |

First admin: use **`INITIAL_ADMIN_USER`** / **`INITIAL_ADMIN_PASS`**. Older names **`AUTH_BOOTSTRAP_USERNAME`** / **`AUTH_BOOTSTRAP_PASSWORD`** still work as aliases.
