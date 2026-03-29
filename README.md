# Humphrey Okoth — Personal Portfolio & Meal Tracker

**Humphrey Okoth Personal Portfolio & Meal Tracker** — a personal portfolio website that showcases work, allows visitors to send contact messages, and includes a private meal/recipe tracker with an admin dashboard.

## Live URLs

| | URL |
|---|---|
| **Site** | https://okothhumphrey.web.app |
| **Backend API** | https://nodejsportfolio-production.up.railway.app |
| **Dashboard** | https://okothhumphrey.web.app/dashboard |
| **Health check** | https://nodejsportfolio-production.up.railway.app/api/health |

---

## Architecture

| Layer | Technology | Role |
|-------|------------|------|
| Frontend | Firebase Hosting | Serves `public/` (HTML, CSS, JS). |
| Backend | Railway (Node / Express) | REST API under `/api/*`. |
| Database | Railway (MySQL) | Users, recipes, contact messages. |
| Email | Resend | Contact form notifications. |

**Firestore:** This repo does **not** use Firestore. Any collections you see in the Firebase console are from an older setup — live data is in MySQL only.

---

## API

**Public:** `GET /api/health` · `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/contact`

**Authenticated** (Bearer JWT): `GET /api/auth/me` · `GET|POST|PATCH|DELETE /api/recipes` · `GET /api/recipes/export.xlsx` · `GET /api/messages` · `DELETE /api/messages/:id` · `POST /api/email-test`

---

## Database (MySQL)

| Table | Contents |
|-------|----------|
| `users` | Username and password hash. |
| `recipes` | Per-user meals — type, title, notes, optional image URL. |
| `contact_messages` | Contact form submissions and metadata. |

Schema defined in `db/migrations/*.sql` — migrations run automatically on server start.

---

## Requirements

**Functional:** Health check · register/login/logout · recipe CRUD with image upload · Excel export · contact form with email · message dashboard · email test endpoint.

**Non-functional:** CORS via `ALLOWED_ORIGINS` · JWT auth · Resend for email · field/upload size limits in code.

---

## Deploy

**Frontend (Firebase):**
```
npx firebase deploy --only hosting
```

**Backend (Railway):** `git push` to `main` — Railway auto-deploys via GitHub integration.

---

## Run locally

1. Set env vars (copy `.env`): `MYSQL_*`, `JWT_SECRET`, optional `INITIAL_ADMIN_USER` / `INITIAL_ADMIN_PASS`. Default port: `7000`.
2. `npm install`
3. `npm start`
4. Health: http://127.0.0.1:7000/api/health

---

## Environment variables

`MYSQL_*` or `MYSQL_PUBLIC_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `RESEND_API_KEY`, `CONTACT_NOTIFY_EMAIL`, `PORT`, optional `INITIAL_ADMIN_USER` / `INITIAL_ADMIN_PASS`.

First admin seed: set `INITIAL_ADMIN_USER` + `INITIAL_ADMIN_PASS`, then remove the password from env after first login.
