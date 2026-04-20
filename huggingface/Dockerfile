# Hugging Face Space Dockerfile.
#
# Runs both FastAPI (port 7860 — HF Spaces' required port) and the LanguageTool
# Java server as a single container. Spaces only expose ONE port, so we bundle
# both processes with a tiny supervisor (s6-overlay style via a shell script).
#
# Memory budget:
#   - LanguageTool JVM: ~1 GB
#   - FastAPI + spaCy + MiniLM (once wired in): ~1.5 GB
#   - Headroom: plenty on HF's free 16 GB CPU Space.

FROM eclipse-temurin:17-jre-jammy AS jre

# --- Python base image with Java from the JRE stage -----------------------------
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    JAVA_HOME=/opt/java \
    PATH=/opt/java/bin:$PATH \
    LT_VERSION=6.5 \
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface/transformers

# Copy Java from the JRE stage.
COPY --from=jre /opt/java/openjdk /opt/java

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Download and extract LanguageTool ------------------------------------------
RUN mkdir -p /opt/languagetool \
 && curl -fsSL "https://languagetool.org/download/LanguageTool-${LT_VERSION}.zip" -o /tmp/lt.zip \
 && unzip -q /tmp/lt.zip -d /opt/languagetool \
 && mv /opt/languagetool/LanguageTool-${LT_VERSION}/* /opt/languagetool/ \
 && rm -rf /opt/languagetool/LanguageTool-${LT_VERSION} /tmp/lt.zip

# --- Install Python backend -----------------------------------------------------
# README.md is required because pyproject.toml declares it as the project readme.
COPY backend/pyproject.toml backend/README.md /app/
RUN pip install --no-cache-dir uv \
 && uv pip install --system --no-cache /app

COPY backend/app /app/app

# --- Entrypoint: start LanguageTool, then uvicorn on HF's required port 7860 ---
COPY huggingface/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# HF Spaces require the app to listen on port 7860.
# CORS is left empty here because the FastAPI middleware already regex-matches
# any *.netlify.app subdomain. If you later attach a custom domain, add it
# as a comma-separated list here (e.g. "https://wryte.example.com").
ENV PORT=7860 \
    LANGUAGETOOL_URL=http://localhost:8010/v2 \
    CORS_ALLOW_ORIGINS=""

EXPOSE 7860

CMD ["/entrypoint.sh"]
