# Deploy LeadBot to Railway

Step-by-step guide once you’ve signed into Railway with GitHub.

---

## 1. Create a new project and add the app

1. In **Railway**, click **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Select your **LeadBot repository** and the branch (e.g. `main`).
4. Railway creates a **service** from the repo. You’ll configure it in the next steps.

---

## 2. Add PostgreSQL

1. In the same project, click **+ New**.
2. Select **Database** → **PostgreSQL**.
3. Railway provisions Postgres and adds a **reference** (variable group) for the new service.
4. Click the **Postgres** service → **Variables** (or **Connect**). Copy the **`DATABASE_URL`** (or note that it’s auto-injected when you link the service).

---

## 3. Add Redis

1. Click **+ New** again.
2. Select **Database** → **Redis**.
3. Railway provisions Redis. It will expose something like **`REDIS_URL`** (check the Redis service’s **Variables** or **Connect**).

---

## 4. Link Postgres and Redis to your app

1. Click your **main app service** (the one from GitHub).
2. Go to **Variables**.
3. Click **+ New Variable** → **Add a reference** (or **Reference**).
4. From the **Postgres** service, add **`DATABASE_URL`**.
5. From the **Redis** service, add **`REDIS_URL`** (or the variable name Railway shows for the Redis connection).

---

## 5. Build: use the Dockerfile (recommended)

This repo includes a **Dockerfile** so Railway uses **pnpm** instead of npm. Railway runs **npm install** by default, which fails on the `workspace:*` protocol used by this pnpm monorepo.

1. With the **Dockerfile** in the repo root, Railway will detect it and build with Docker (no need to set Build Command in the dashboard).
2. **Root Directory**: leave **empty** so the Dockerfile at repo root is used.
3. The Dockerfile runs `pnpm install --frozen-lockfile` and `pnpm build`, then at runtime `pnpm db:migrate:deploy && pnpm --filter web start`.

If you prefer not to use Docker and use Railpack instead:

- **Root Directory**: leave **empty** (repo root) so Railway finds `pnpm-lock.yaml` and uses pnpm.
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm start`

---

## 6. Add the rest of the environment variables

In the **app service** → **Variables**, add (or reference):

| Variable | Value | Notes |
|----------|--------|--------|
| `NEXTAUTH_URL` | `https://YOUR-APP.up.railway.app` | Replace with your app’s Railway URL (from **Settings** → **Domains**). Use the same value after you add a custom domain. |
| `NEXTAUTH_SECRET` | (random string) | Generate with: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Same as `NEXTAUTH_URL` | e.g. `https://YOUR-APP.up.railway.app` – used for widget script and demo links. |
| `OPENAI_API_KEY` | `sk-...` | Your OpenAI API key (required for chat). |
| `OPENAI_MODEL` | `gpt-4o-mini` | Optional; this is the default. |

Optional:

- `IP_HASH_SALT` – random string if you use IP hashing (GDPR).
- `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` – only if you use HubSpot.

You should **not** set `DATABASE_URL` or `REDIS_URL` manually if you added them as references from the Postgres and Redis services.

---

## 7. Use the correct Node / pnpm version (if needed)

Railway usually detects Node from `engines` in `package.json`. If you see install or build errors:

- In **Settings**, set **Node version** to **20** (or 18+) if there’s a field for it.
- The repo has `"packageManager": "pnpm@9.14.2"` and `"node": ">=18"`, so Railway’s Nixpacks should use pnpm. If it uses npm instead, add a **Nixpacks** config or a **nixpacks.toml** at repo root (see step 10) to force pnpm.

---

## 8. Deploy and get the URL

1. Save all settings and variables. Railway will run a **build** then **start**. (Railway sets `PORT`; Next.js uses it automatically.)
2. Open the **app service** → **Settings** → **Networking** or **Domains**.
3. Click **Generate domain** (or **Add domain**). You’ll get a URL like `https://your-app-name.up.railway.app`.
4. Update variables:
   - Set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to this URL (with `https://`).
5. Redeploy if needed (e.g. **Redeploy** from the **Deployments** tab) so the app starts with the correct URL.

---

## 9. Run the database seed (first time only)

After the first successful deploy and migrations:

1. **Option A – Railway shell**  
   In the app service, open **Settings** or the **Deployments** tab and look for **Shell** / **Run command** (or use **Railway CLI**). Run once:
   ```bash
   pnpm db:seed
   ```
   This creates the demo tenant and user (e.g. `admin@democompany.com` / `demo1234`).

2. **Option B – Local**  
   Point your local `.env` at the Railway Postgres URL (copy from Railway Postgres variables), then run:
   ```bash
   pnpm db:seed
   ```
   Do not run seed repeatedly in production if it would duplicate data.

---

## 10. Add the worker (CRM / webhooks)

The dashboard and widget work without the worker, but **webhook and HubSpot pushes** need a separate process.

1. In the **same project**, click **+ New** → **Empty Service** (or **GitHub Repo** again and select the same repo).
2. Name it e.g. **worker**.
3. **Settings** for the worker:
   - **Root Directory**: leave empty.
   - **Build Command**: `pnpm install && pnpm db:generate`
   - **Start Command**: `pnpm --filter web worker`
4. **Variables**: add the **same references** as the web app:
   - Reference **`DATABASE_URL`** from Postgres and **`REDIS_URL`** from Redis.
   - Copy (or reference) **`OPENAI_API_KEY`**, **`NEXTAUTH_SECRET`**, **`NEXT_PUBLIC_APP_URL`**, and any HubSpot vars so the worker can run jobs that need them.
5. The worker does **not** need a public domain; it only needs to reach Redis and the DB.

---

## 11. (Optional) Force pnpm via Nixpacks

If Railway uses **npm** instead of **pnpm** and the build fails, add a Nixpacks config at the **repo root** so the install uses pnpm.

Create **nixpacks.toml** in the project root:

```toml
[phases.setup]
nixPkgs = ["nodejs_20", "pnpm"]

[phases.install]
cmds = ["pnpm install --frozen-lockfile"]
```

Then commit, push, and let Railway redeploy.

---

## 12. Check that everything works

1. Open `https://YOUR-APP.up.railway.app` → you should see the login page.
2. Log in with the seeded user (e.g. `admin@democompany.com` / `demo1234`).
3. Go to **Sider** → **Konfigurer** for a site → click **Se demo** and test the widget.
4. (Optional) In **Integrationer** set a webhook (e.g. RequestBin), qualify a lead in the widget, and confirm the worker sends the POST (worker must be running).

---

## Quick reference

| Item | Value |
|------|--------|
| Build | `pnpm install && pnpm build` |
| Start (web) | `pnpm start` (runs migrations + Next.js) |
| Start (worker) | `pnpm --filter web worker` |
| Required vars | `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `OPENAI_API_KEY` |
| First-time DB | Migrations run on `pnpm start`; run `pnpm db:seed` once for demo user |

---

## Troubleshooting

**"Unsupported URL Type workspace:*" or "npm install" runs instead of pnpm**  
Railway is using npm, which doesn’t support pnpm’s `workspace:*`. Use the **Dockerfile** in the repo root so the build uses pnpm (Railway builds with Docker when a Dockerfile is present). Ensure **Root Directory** is empty.

**"Module not found: Can't resolve '@leadbot/shared'"**  
The build is running only the web app instead of the full monorepo. Use the **Dockerfile** (recommended) or set **Root Directory** to **empty** and **Build Command** to `pnpm install && pnpm build`, then redeploy.

**Other deploy failures**  
Check the **build** and **deploy** logs in Railway (e.g. missing env var, wrong Node version, or Prisma/client issues).
