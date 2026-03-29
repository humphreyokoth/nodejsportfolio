# Humphrey Okoth — Personal Portfolio & Meal Tracker
## Technical Documentation

## System Name

**Humphrey Okoth Personal Portfolio & Meal Tracker** — a personal portfolio website for Humphrey Okoth that showcases his work, allows visitors to send contact messages, and includes a private meal/recipe tracker with an admin dashboard.

## Overview

The system is a **static site** on **Firebase Hosting** that talks to a **Node.js API** on **Railway**. All application data lives in **MySQL** on Railway. Email uses **Resend**. Login uses **JWT + bcrypt** (not Firebase Auth).

## Architecture

| Layer | Technology | Role |
|-------|------------|------|
| Frontend | Firebase Hosting | Serves `public/` (HTML, CSS, JS). |
| Backend | Railway (Node / Express) | REST API under `/api/*`. |
| Database | Railway (MySQL) | Users, recipes, contact messages. |
| Email | Resend | Contact notifications. |

**Firestore:** This repo does **not** use Firestore. Any `recipes` / `contactMessages` you see in the Firebase console are from an older setup; live data is only in MySQL. You can delete those Firestore collections in the console if you do not need them.

## Live URLs

| | URL |
|---|-----|
| Site | https://okothhumphrey.web.app |
| API | https://nodejsportfolio-production.up.railway.app |
| Health check | `GET /api/health` returns `{"ok":true}` |

The browser uses `API_BASE` in `public/js/api-config.js` (no trailing slash).

## API (summary)

**Public:** `GET /api/health` · `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/contact`

**Authenticated** (Bearer JWT or cookie): `GET /api/auth/me` · `GET|POST|PATCH|DELETE /api/recipes` · `GET /api/recipes/export.xlsx` · `GET /api/messages` · `DELETE /api/messages/:id` · `POST /api/email-test`

Main pages: `/`, `/about`, `/contact`, `/recipes`, `/dashboard` (see `firebase.json` rewrites).

## MySQL tables

| Table | Contents |
|-------|----------|
| `users` | Username and password hash. |
| `recipes` | Per-user meals (type, title, notes, optional image URL). |
| `contact_messages` | Contact form rows and metadata. |

**Schema in Git:** `db/migrations/*.sql`. **Live DB:** connect with Railway MySQL variables, then `mysqldump -h … -u … -p --no-data DATABASE > schema.sql`, or `railway connect mysql` and run `SHOW TABLES;`.

**Firestore:** No fixed schema; inspect in the Firebase console, or use `gcloud firestore export` for a full backup.

## Requirements (short)

**Functional:** Health check; register/login/logout; recipe CRUD and image upload; Excel export; contact form with email; dashboard for messages; email test endpoint.

**Non-functional:** CORS via `ALLOWED_ORIGINS`; JWT in production; migrations on startup; Resend for mail; field and upload limits in code.

## Deploy

**Frontend:** `npx firebase deploy --only hosting` (from project root, after `firebase login`).

**Backend:** Push to the Git branch connected to Railway, or redeploy from the Railway dashboard.

## Environment (examples)

`MYSQL_*` or `MYSQL_PUBLIC_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `RESEND_API_KEY`, `CONTACT_NOTIFY_EMAIL`, optional `INITIAL_ADMIN_USER` / `INITIAL_ADMIN_PASS`, `PORT`.

---

**Microsoft Word:** Open this `.md` in Word (*File → Open*), or run `pandoc docs/PORTFOLIO-DOC.md -o portfolio.docx` if you have [Pandoc](https://pandoc.org) installed.

*Update URLs if your Railway service name or Firebase project changes.*
