---
title: Wryte API
emoji: 🔍
colorFrom: indigo
colorTo: slate
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Diagnostic scoring backend for the Wryte dashboard.
---

# Wryte API (Hugging Face Space)

This Space hosts the FastAPI backend + LanguageTool grammar server for the [Wryte](https://github.com/sivasakthi-v/Wryte) Content Intelligence Dashboard.

The container runs two processes: the LanguageTool Java server on port 8010 (internal) and FastAPI on port 7860 (exposed by HF Spaces).

## Endpoints

- `GET /` — service metadata.
- `GET /health` — liveness.
- `POST /analyze` — analyze text, return scored diagnostic response.
- `GET /docs` — interactive OpenAPI docs.

## Deployment

Deploys are pushed by the `.github/workflows/deploy-space.yml` workflow in the main GitHub repo on every merge to `main`. The workflow syncs `backend/` and `huggingface/` into this Space.
