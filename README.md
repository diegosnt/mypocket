# MyPocket — Expense Tracker

A lightweight, serverless expense tracking app built with Node.js, Express, Turso (LibSQL), and Vanilla JS. Deployed as a monorepo on Vercel.

---

## Production Deployment Guide

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- A [GitHub](https://github.com/) account
- A [Turso](https://turso.tech/) account (free tier works)
- A [Vercel](https://vercel.com/) account (free tier works) — connected to your GitHub

---

### Step 1 — Create the Turso Database

1. Install the Turso CLI:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```

2. Log in:
   ```bash
   turso auth login
   ```

3. Create a database:
   ```bash
   turso db create mypocket
   ```

4. Get the database URL:
   ```bash
   turso db show mypocket --url
   # → libsql://mypocket-<your-name>.turso.io
   ```

5. Create an auth token:
   ```bash
   turso db tokens create mypocket
   # → eyJ... (copy this, you'll need it in Step 3)
   ```

---

### Step 2 — Configure Local Environment

Copy the example file and fill in your values:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
TURSO_DATABASE_URL=libsql://mypocket-<your-name>.turso.io
TURSO_AUTH_TOKEN=<token from Step 1>
JWT_SECRET=<a long random string — use: openssl rand -hex 32>
PORT=3000
```

> The database tables are created automatically on first startup — no migration step needed.

---

### Step 3 — Test Locally

```bash
# Install backend dependencies
cd backend
pnpm install

# Start the API server
pnpm start
```

Open `frontend/src/index.html` directly in your browser, or use a local static server:

```bash
# From the project root
npx serve frontend/src
```

Register an account, add a few expenses, and confirm everything works before deploying.

---

### Step 4 — Push to GitHub

Initialize the repository and push:

```bash
git init
git add .
git commit -m "feat: initial project setup"
```

Create the repo on GitHub (replace `<your-username>`):

```bash
gh repo create <your-username>/mypocket --public --source=. --remote=origin --push
```

> If you prefer to do it manually: create a new repo on github.com, then run:
> ```bash
> git remote add origin https://github.com/<your-username>/mypocket.git
> git push -u origin main
> ```

---

### Step 5 — Deploy to Vercel via GitHub

#### 5.1 — Import the project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your `mypocket` repo
4. Leave **Root Directory** as `.` (project root)
5. **Do not** change the Framework Preset — leave it as "Other"

#### 5.2 — Set environment variables

Before clicking **Deploy**, expand the **Environment Variables** section and add:

| Name | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://mypocket-<your-name>.turso.io` |
| `TURSO_AUTH_TOKEN` | your token from Step 1 |
| `JWT_SECRET` | a long random string (`openssl rand -hex 32`) |

#### 5.3 — Deploy

Click **Deploy**. Vercel will build and publish the app. When it finishes, it gives you a URL like `https://mypocket.vercel.app`.

> **Every `git push` to `main` triggers an automatic re-deploy.** No CLI needed.

---

### Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `TURSO_DATABASE_URL` | LibSQL connection URL from Turso | `libsql://mypocket-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | Auth token for the Turso database | `eyJ...` |
| `JWT_SECRET` | Secret key for signing JWT tokens | 32+ random characters |
| `PORT` | Port for local dev only (Vercel ignores this) | `3000` |

---

### Project Structure

```
/
├── backend/
│   ├── src/
│   │   ├── config/db.js          # Turso client + table init
│   │   ├── controllers/          # Auth and expense business logic
│   │   ├── middlewares/auth.js   # JWT verification
│   │   ├── routes/               # /api/auth and /api/expenses
│   │   └── app.js                # Express entry point
│   └── package.json
├── frontend/
│   └── src/
│       ├── css/style.css         # Layout, variables, components
│       ├── js/
│       │   ├── api.js            # Fetch client (dev/prod URL switching)
│       │   ├── auth.js           # Login / register logic
│       │   └── dashboard.js      # Expense CRUD + Chart.js
│       └── index.html
└── vercel.json                   # Routes /api/* → backend, /* → frontend
```

---

### API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create account |
| `POST` | `/api/auth/login` | No | Sign in, returns JWT |
| `GET` | `/api/expenses` | Yes | List user's expenses |
| `POST` | `/api/expenses` | Yes | Create expense |
| `PUT` | `/api/expenses/:id` | Yes | Update expense |
| `DELETE` | `/api/expenses/:id` | Yes | Delete expense |
| `GET` | `/api/health` | No | Health check |

All protected endpoints require: `Authorization: Bearer <token>`

---

### Re-deploying

Push to `main` — Vercel deploys automatically:

```bash
git add .
git commit -m "feat: your change"
git push
```

No build step, no CLI needed.

---

### Troubleshooting

**API returns 500 after deploy**
Go to Vercel → your project → **Settings → Environment Variables** and confirm all three variables are present. Then redeploy from **Deployments → Redeploy**.

**`TURSO_DATABASE_URL` is undefined at runtime**
In the Vercel dashboard, make sure the variable is enabled for the **Production** environment (not just Preview or Development).

**CORS errors in the browser**
The backend allows all origins by default. For stricter production config, update `cors()` in `backend/src/app.js`:
```js
app.use(cors({ origin: 'https://your-domain.vercel.app' }));
```

**Token expired / auto-logout**
JWT tokens expire after 7 days. Users will be redirected to login automatically.
