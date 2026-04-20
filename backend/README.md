# Wryte API

FastAPI backend for the Wryte Content Intelligence Dashboard.

## Running locally

From the repo root:

```bash
docker compose up api languagetool
```

Or standalone (requires Python 3.11+ and uv):

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Endpoints (V1 skeleton)

- `GET /health` — liveness probe.
- `POST /analyze` — returns a stubbed analysis response. Real scoring lands bucket-by-bucket starting with readability.

## Tests

```bash
cd backend
uv run pytest
```

## Layout

See `Plan_v1.md` section 9.
