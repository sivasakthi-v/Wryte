# Wryte

A Content Intelligence Dashboard. Paste text in, get a 100-point diagnostic score with bucketed, actionable fixes out — diagnostic instrument, not content generator.

See `../Plan_v1.md` for the full product and engineering plan.

## Status

V1 scaffold in progress. Paste-text MVP only. Not yet functional.

## Architecture at a glance

- **Frontend** — Next.js 14 + React + TypeScript + Tailwind + shadcn/ui, hosted on Netlify.
- **Backend** — FastAPI (Python 3.11+) with textstat, spaCy, sentence-transformers, textdescriptives, hosted on Hugging Face Spaces (Docker).
- **Grammar sidecar** — LanguageTool (Java) server, shipped as a Docker sidecar in dev and bundled into the Space image in prod.
- **Storage** — SQLite in dev; same in prod on the Space's persistent volume.

Source of truth for architecture: `../Plan_v1.md`, sections 3 and 4.

## Local development

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (required — runs all three services)
- [Git](https://git-scm.com/)
- (Optional, for faster iteration outside Docker) Node.js 20+ with [pnpm](https://pnpm.io/) and Python 3.11+ with [uv](https://docs.astral.sh/uv/)

### One-command boot

```bash
docker compose up --build
```

Services:

| Service      | URL                    | Purpose                           |
| ------------ | ---------------------- | --------------------------------- |
| frontend     | http://localhost:3000  | Next.js dashboard                 |
| api          | http://localhost:8000  | FastAPI analyzer                  |
| languagetool | http://localhost:8010  | LanguageTool grammar server       |

API docs (auto-generated): http://localhost:8000/docs

### Running services individually (outside Docker)

Backend:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
pnpm install
pnpm dev
```

LanguageTool (still via Docker even if the rest runs native):

```bash
docker run -d --rm -p 8010:8010 erikvl87/languagetool
```

## Deployment

- **Frontend → Netlify**: connect the GitHub repo in Netlify's dashboard, set `NEXT_PUBLIC_API_URL` to the Hugging Face Space URL, publish.
- **Backend → Hugging Face Space**: the `deploy-space.yml` workflow pushes the backend to the Space on every merge to `main`. Requires `HF_TOKEN` and `HF_SPACE` repo secrets.

See `Plan_v1.md` section 10 for the full hosting topology.

## Repo layout

See `Plan_v1.md` section 9.

## License

TBD — likely MIT. See the LICENSE file once it exists.
