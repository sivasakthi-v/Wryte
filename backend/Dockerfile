# syntax=docker/dockerfile:1.7
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps: curl for healthchecks, build tools deferred to when NLP deps get added.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Install uv — fast Python package manager.
RUN pip install --no-cache-dir uv

# Install Python deps first for better layer caching.
# README.md is needed because pyproject.toml declares it as the project readme.
COPY pyproject.toml README.md ./
RUN uv pip install --system --no-cache .

# Copy application code.
COPY app ./app

# Create data directory for SQLite.
RUN mkdir -p /app/data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
