# Wryte Setup Guide

Step-by-step: from freshly-scaffolded repo to everything deployed. Follow in order.

## Phase 1 — Install local tools

You'll need three things beyond Git (which you already have).

**Docker Desktop** — runs the backend, LanguageTool, and frontend locally with one command. Download from https://www.docker.com/products/docker-desktop/. On Windows it runs on WSL 2 — the installer walks you through enabling it. After install, open Docker Desktop once so it starts the daemon.

**Node.js 20+** — download the LTS installer from https://nodejs.org/. Once installed, run `corepack enable` in a new terminal so `pnpm` becomes available (it ships with Node 20+ but needs to be enabled).

**Python 3.11+** — download from https://www.python.org/downloads/. During install on Windows, tick "Add python.exe to PATH".

Verify each one in a fresh terminal:

```bash
git --version
docker --version
node --version
python --version
```

If any fail, fix that before continuing.

## Phase 2 — Run it locally

From the `clarityscope/` directory (the folder name stays `clarityscope/` for now — only the product name is Wryte):

```bash
# Copy env template (safe to commit .env.example, NOT .env)
cp .env.example .env

# Boot everything.
docker compose up --build
```

First boot downloads Python base image, Node image, the LanguageTool image (~1 GB), and installs all deps. Expect 5–10 minutes. Subsequent boots are fast.

When it's up:

- Open http://localhost:3000 — you should see the Wryte dashboard.
- Paste some text, click **Analyze**. You'll get a stubbed response — that's expected in V1 skeleton. The pipeline is wired end-to-end; the analyzer bodies come next.
- Open http://localhost:8000/docs — interactive API docs.
- Open http://localhost:8010/v2/languages — confirms LanguageTool is reachable.

If something fails, check `docker compose logs api` or `docker compose logs frontend`.

## Phase 3 — Push to GitHub

```bash
cd clarityscope
git init -b main
git add .
git commit -m "Initial scaffold"
```

Create a new repo on GitHub (public is recommended — it gives you unlimited GitHub Actions minutes). Name it `wryte` or whatever you prefer. Don't initialize with a README — we already have one.

```bash
git remote add origin https://github.com/<your-username>/wryte.git
git push -u origin main
```

Once pushed, check the **Actions** tab on GitHub. The `CI` workflow should run automatically and pass (backend tests + lint). The `Deploy to Hugging Face Space` workflow will fail the first time because the `HF_TOKEN` and `HF_SPACE` secrets don't exist yet — that's expected; we fix it in Phase 5.

## Phase 4 — Connect Netlify

You already have a Netlify account. Good.

1. In the Netlify dashboard, click **Add new site → Import an existing project**.
2. Choose **GitHub** as the provider and authorize if prompted.
3. Pick the `wryte` repo.
4. Netlify auto-detects the `netlify.toml` config. Leave the defaults. Base directory should show `frontend`, build command `pnpm build`, publish directory `frontend/.next`.
5. Before clicking Deploy, go to **Site settings → Environment variables** and add:
   - `NEXT_PUBLIC_API_URL` = `https://CHANGE_ME.hf.space` (we'll replace this with the real Space URL after Phase 5)
6. Click **Deploy**. The first build will succeed, but the frontend won't be able to reach the backend until Phase 5 finishes.

Your site will be at something like `https://adjective-noun-12345.netlify.app`. You can rename it in site settings.

## Phase 5 — Connect Hugging Face Space

5.1 — Sign up at https://huggingface.co (free).

5.2 — Create a Space: https://huggingface.co/new-space.
- **Owner**: your HF username.
- **Space name**: `wryte` (or your preference).
- **License**: MIT.
- **SDK**: Docker.
- **Template**: Blank.
- **Public/Private**: Public (private requires a paid plan).
- **Hardware**: CPU basic (free).

Click **Create Space**. It'll show an empty Space placeholder. The deploy workflow will push the real code shortly.

5.3 — Create an HF access token:
- Go to https://huggingface.co/settings/tokens.
- Click **New token**. Name: `wryte-deploy`. Role: **Write**. Copy the token value — you won't see it again.

5.4 — Add GitHub secrets:
- In your GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret**.
- Add two:
  - `HF_TOKEN` = the token you just copied.
  - `HF_SPACE` = `<your-hf-username>/wryte` (e.g. `sivavenkat/wryte`).

5.5 — Trigger the deploy:
- Push any trivial change to `main` (e.g. edit the README), OR
- Go to **Actions → Deploy to Hugging Face Space → Run workflow** to trigger manually.

The workflow pushes the backend to the Space. On the Space page, you'll see it building a Docker image. First build takes 5–10 minutes because it downloads the Java runtime and LanguageTool (~600 MB). Once "Running", the Space is live at `https://<your-username>-wryte.hf.space`.

Test it directly:

```bash
curl https://<your-username>-wryte.hf.space/health
# → {"status":"ok"}
```

5.6 — Update Netlify env var:
- Back in Netlify → **Site settings → Environment variables**, edit `NEXT_PUBLIC_API_URL` to the real Space URL (e.g. `https://sivavenkat-wryte.hf.space`).
- Trigger a redeploy: **Deploys → Trigger deploy → Deploy site**.

5.7 — Update CORS on the backend so Netlify can reach it:
- On HF Space → **Settings → Variables and secrets**, add:
  - `CORS_ALLOW_ORIGINS` = your Netlify URL, e.g. `https://your-site.netlify.app`.
- The Space auto-rebuilds.

## Phase 6 — Verify end-to-end

Open your Netlify URL in a browser. Paste text, click Analyze. You should get the stubbed analysis response back — same as you saw locally, now served from the live Netlify + HF Space pipeline.

If you get a CORS error in the browser console, re-check Phase 5.7.

If the first request takes 30–60 seconds, that's HF Spaces waking from idle sleep. Subsequent requests within the same session are fast.

## What you've now got

- Source on GitHub, CI green on every PR.
- Frontend auto-deploying to Netlify on every push to `main`, preview URL on every PR.
- Backend auto-deploying to HF Spaces on every push to `main` that touches `backend/` or `huggingface/`.
- A working but stubbed end-to-end pipeline.

**Next**: say the word and I'll start on the readability bucket — the first real scoring logic.
