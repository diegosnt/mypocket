# MyPocket — Personal Finance Tracker

A lightweight, serverless income and expense tracker built with Node.js, Express, Turso (LibSQL), and Vanilla JS. No build step. Deployed as a monorepo on Vercel.

---

## Features

- Register and log in with email and password (JWT auth)
- Record income and expense transactions
- Multi-currency support: **ARS** and **USD** — filtered independently
- **Categories** with custom colors — full CRUD management
- **Origins** (payment methods: Débito, Crédito, Efectivo, etc.) — full CRUD management
- Desktop spreadsheet-style table with column sorting and per-column filters
- Mobile card layout
- Monthly expense breakdown chart (opens in a modal)
- Dark mode

---

## Production Deployment

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- A [GitHub](https://github.com/) account
- A [Turso](https://turso.tech/) account (free tier works)
- A [Vercel](https://vercel.com/) account connected to your GitHub

---

### Step 1 — Create the Turso Database

```bash
# Install CLI
curl -sSfL https://get.tur.so/install.sh | bash

turso auth login
turso db create mypocket

# Save these for Step 3
turso db show mypocket --url          # libsql://mypocket-<name>.turso.io
turso db tokens create mypocket       # eyJ...
```

---

### Step 2 — Configure Local Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
TURSO_DATABASE_URL=libsql://mypocket-<your-name>.turso.io
TURSO_AUTH_TOKEN=<token from Step 1>
JWT_SECRET=<random string — use: openssl rand -hex 32>
FRONTEND_URL=http://localhost:5500
PORT=3000
```

> Tables and seed data are created automatically on first startup — no manual migration needed.

---

### Step 3 — Test Locally

```bash
cd backend && pnpm install && pnpm start
```

Open the frontend with a local static server:

```bash
npx serve frontend/src
```

Register an account, add a few transactions, and confirm everything works before deploying.

---

### Step 4 — Push to GitHub

```bash
gh repo create <your-username>/mypocket --public --source=. --remote=origin --push
```

---

### Step 5 — Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your `mypocket` repo
2. Leave **Root Directory** as `.` and Framework Preset as **Other**
3. Add these environment variables before clicking Deploy:

| Name | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://mypocket-<your-name>.turso.io` |
| `TURSO_AUTH_TOKEN` | your token from Step 1 |
| `JWT_SECRET` | a long random string |
| `FRONTEND_URL` | `https://your-app.vercel.app` |

4. Click **Deploy**

> Every `git push` to `main` triggers an automatic redeploy.

---

## Environment Variables

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | LibSQL connection URL from Turso |
| `TURSO_AUTH_TOKEN` | Auth token for the Turso database |
| `JWT_SECRET` | Secret for signing JWT tokens (32+ chars) |
| `FRONTEND_URL` | Allowed CORS origin (your Vercel URL in production) |
| `PORT` | Local dev only — Vercel ignores this |

---

## Project Structure

```
/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                 # Turso client, table init, seed data
│   │   ├── controllers/
│   │   │   ├── authController.js     # Register / login
│   │   │   ├── categoryController.js # Category CRUD
│   │   │   ├── originController.js   # Origin CRUD
│   │   │   └── transactionController.js  # Transaction CRUD
│   │   ├── middlewares/
│   │   │   └── auth.js               # JWT Bearer verification
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── categories.js
│   │   │   ├── origins.js
│   │   │   └── transactions.js
│   │   └── app.js                    # Express entry point
│   └── package.json
├── frontend/
│   └── src/
│       ├── css/style.css             # Design tokens, layout, components
│       ├── js/
│       │   ├── api.js                # Fetch client with auth headers
│       │   ├── auth.js               # Login form logic
│       │   ├── dashboard.js          # Table, filters, sort, CRUD, chart modal
│       │   └── theme.js              # Dark/light mode toggle
│       └── index.html                # SPA shell — auth + dashboard views
└── vercel.json                       # Routes /api/* → serverless, /* → static
```

---

## Database Schema

```sql
users         (id, name, email, password_hash, created_at)
categories    (id, name, color, created_at)
origins       (id, name, created_at)
transactions  (id, user_id, type, amount, description, category,
               origin, date, currency, created_at)
```

All schema changes run as `ALTER TABLE ... ADD COLUMN` migrations with `.catch(() => {})` — safe on repeated cold starts.

---

## API Endpoints

All endpoints under `/api/`. Protected routes require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/register` | No |
| `POST` | `/api/auth/login` | No |

### Transactions
| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/transactions` | Yes |
| `POST` | `/api/transactions` | Yes |
| `PUT` | `/api/transactions/:id` | Yes |
| `DELETE` | `/api/transactions/:id` | Yes |

### Categories
| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/categories` | Yes |
| `POST` | `/api/categories` | Yes |
| `PUT` | `/api/categories/:id` | Yes |
| `DELETE` | `/api/categories/:id` | Yes |

### Origins
| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/origins` | Yes |
| `POST` | `/api/origins` | Yes |
| `PUT` | `/api/origins/:id` | Yes |
| `DELETE` | `/api/origins/:id` | Yes |

### Health
| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/health` | No |

> Deleting a category or origin that is referenced by existing transactions returns `409 Conflict`. Renaming one cascades the update to all linked transactions.

---

## Redeploy

```bash
git add .
git commit -m "feat: your change"
git push
```

---

## Troubleshooting

**API returns 503 on first request after deploy**
The DB initializes lazily on the first request — this is expected. Subsequent requests are instant.

**API returns 500 after deploy**
Go to Vercel → your project → **Settings → Environment Variables** and confirm all variables are present and enabled for **Production**. Then redeploy.

**CORS errors in the browser**
Set the `FRONTEND_URL` environment variable in Vercel to your exact deployment URL (e.g. `https://mypocket.vercel.app`). No trailing slash.

**Token expired / auto-logout**
JWT tokens expire after 7 days. Users are redirected to login automatically.
