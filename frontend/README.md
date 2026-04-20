# Wryte Frontend

Next.js 14 (App Router) + TypeScript + Tailwind dashboard for Wryte.

## Running locally

From the repo root:

```bash
docker compose up frontend api languagetool
```

Or standalone (requires Node 20+ and pnpm 9+):

```bash
cd frontend
cp .env.local.example .env.local    # then edit NEXT_PUBLIC_API_URL if needed
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Scripts

- `pnpm dev` — start the Next.js dev server with hot reload.
- `pnpm build` — production build.
- `pnpm start` — serve the production build.
- `pnpm lint` — ESLint.
- `pnpm typecheck` — TypeScript check without emit.
- `pnpm test` — Vitest unit tests.

## Env vars

- `NEXT_PUBLIC_API_URL` — base URL of the FastAPI backend. Defaults to `http://localhost:8000`.
