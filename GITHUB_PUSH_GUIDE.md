# GitHub Push & Deployment Guide

End-to-end steps to push `ai-accounting-platform` to GitHub and deploy the frontend to Netlify or Vercel.

> The repository is **already initialized and committed** (`git init -b main` + first commit were done during assembly). If you are starting from a fresh clone or an empty folder, run the **§1** steps; otherwise skip straight to **§3 (create the GitHub repo)** and **§4 (push)**.

---

## 0. Prerequisites

- Git installed (`git --version`).
- A GitHub account.
- **Either** the GitHub CLI (`gh`) **or** the ability to create a repo in the GitHub web UI.
- Node 20+ if you want to re-run install/build/test locally before pushing.

Verify the working tree is clean before pushing:

```bash
git status            # should say "nothing to commit, working tree clean"
git log --oneline -1  # shows the initial commit
```

---

## 1. Initialize git (only if NOT already a repo)

Skip this section if `git status` already works — the repo is initialized.

```bash
cd /path/to/ai-accounting-platform
git init -b main
git config user.name  "Your Name"
git config user.email "you@example.com"
```

---

## 2. Stage & commit (only if you have uncommitted changes)

The first commit already exists. Use this only for follow-up changes (e.g. committing this guide):

```bash
git add -A
git status            # review what will be committed — no node_modules/.zip/.env/dist
git commit -m "docs: add GitHub push & deployment guide"
```

**What is intentionally NOT committed** (see `.gitignore`):
`node_modules/`, `dist/`, `.next/`, `out/`, `.env` (only `.env.example` is tracked),
`_archive/` (the per-task build zips), `.claude/`, `*.log`.

---

## 3. Create the GitHub repository

### Option A — GitHub CLI (fastest)

```bash
# authenticate once if needed:
gh auth login

# create a PRIVATE repo from the current folder (recommended for proprietary code):
gh repo create ai-accounting-platform --private --source=. --remote=origin --description "AI-powered Bulgarian-first accounting platform (EUR-native)"
```

`--source=. --remote=origin` creates the repo **and** wires up the `origin` remote in one step. If you use this, **skip §4’s `git remote add`** and go straight to `git push`.

### Option B — GitHub web UI

1. Go to <https://github.com/new>.
2. **Repository name:** `ai-accounting-platform`
3. **Visibility:** **Private** (recommended — this is proprietary, `LicenseRef-Proprietary`).
4. **Do NOT** initialize with a README, .gitignore, or license (the repo already has them — an init would cause a push conflict).
5. Click **Create repository**, then continue to §4.

---

## 4. Add the remote and push

> Skip the `git remote add` line if you used `gh repo create --source=.` in §3 (it was added for you). Verify with `git remote -v`.

Replace `<YOUR_GITHUB_USERNAME>` with your account (or org) name.

**HTTPS:**

```bash
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/ai-accounting-platform.git
git push -u origin main
```

**SSH** (if you have SSH keys set up):

```bash
git remote add origin git@github.com:<YOUR_GITHUB_USERNAME>/ai-accounting-platform.git
git push -u origin main
```

Confirm:

```bash
git remote -v
git branch -vv        # main should track origin/main
```

After this, the GitHub Actions CI (`.github/workflows/ci.yml`) runs automatically on the push: **api** (typecheck/lint/build/test on Postgres + Redis), **web** (typecheck/lint/build), and **docker** (`docker compose config`).

---

## 5. Netlify deployment (frontend — `apps/web`)

The frontend is a **Next.js static export** (`output: 'export'` → `apps/web/out`). It needs no serverless runtime.

1. Push the repo to GitHub (§4).
2. In Netlify: **Add new site → Import an existing project → GitHub**, pick `ai-accounting-platform`.
3. **Build settings:**
   - **Base directory:** `apps/web`
   - **Build command:** `next build`
   - **Publish directory:** `apps/web/out`
4. **Environment variables** (Site configuration → Environment variables):
   - `NEXT_PUBLIC_API_URL` = `https://api.<your-domain>` *(omit to run the backend-free mock preview)*
   - `NEXT_PUBLIC_USE_MOCK` = `false` *(set `true` for a fully navigable demo with no backend)*
5. **Deploy site.** Netlify builds the static export and serves `out/`.
6. On the **backend**, set `CORS_ORIGINS` to the Netlify URL (e.g. `https://<site>.netlify.app`) so the browser may call the API with credentials.
7. Verify: open the site → the dashboard loads; network calls hit `https://api.<your-domain>/...`.

*Prefer the full Next runtime instead of static export? Add the `@netlify/plugin-nextjs` plugin and drop the publish directory.*

---

## 6. Vercel deployment (frontend — `apps/web`)

1. Push the repo to GitHub (§4).
2. In Vercel: **Add New → Project**, import `ai-accounting-platform`.
3. **Configure Project:**
   - **Root Directory:** `apps/web`
   - **Framework Preset:** **Next.js** (auto-detected; build & output inferred)
4. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = `https://api.<your-domain>`
   - `NEXT_PUBLIC_USE_MOCK` = `false`
5. **Deploy.**
6. Set the backend `CORS_ORIGINS` to the Vercel URL (`https://<project>.vercel.app`).
7. Verify the deployed app calls the real API.

---

## 7. Backend deployment (reference)

The frontend platforms above host only `apps/web`. The **API + worker** (`apps/api`) deploy as containers — full ops detail is in [DEPLOYMENT.md](DEPLOYMENT.md) and [PREVIEW_RELEASE_v1.md](PREVIEW_RELEASE_v1.md). In short: API + worker on AWS ECS Fargate (Frankfurt) behind an ALB health-checking `/health/ready`; RDS PostgreSQL 16; ElastiCache Redis; S3 with Object Lock; secrets in AWS Secrets Manager. Point `NEXT_PUBLIC_API_URL` at the API and the API's `CORS_ORIGINS` at the frontend URL.

For a full local stack: `cp .env.example .env` (fill real values) then `docker compose up --build` (web `:8080`, API `:3000`).

---

## 8. Quick command reference

```bash
# one-time, fresh folder only:
git init -b main

# every change:
git add -A
git commit -m "type(scope): message"

# create + wire remote (gh, one step):
gh repo create ai-accounting-platform --private --source=. --remote=origin

# OR wire an existing GitHub repo manually:
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/ai-accounting-platform.git

# push:
git push -u origin main
```
