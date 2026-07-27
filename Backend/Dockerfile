# NOTE: the live Render deployment (see /render.yaml, runtime: python) uses
# Render's native Python buildpack and does NOT build or run this file — its
# non-root user, HEALTHCHECK, and image-size hardening currently apply to no
# running deployment. This Dockerfile is for local docker-compose or a future
# containerized deploy target (k8s/README.md). If Render is ever switched to
# `runtime: docker`, this becomes the actual production image and this note
# should be removed.
#
# Multi-stage build for production-ready image
FROM python:3.11-slim as builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    portaudio19-dev \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Create virtual environment and install dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# NOTE: torch is intentionally NOT installed here. requirements.txt excludes
# transformers/sentence-transformers specifically because they pull in torch
# (~700 MB RSS) which doesn't fit the 512 MB Render Starter budget — see the
# comment there. crisis_nlp.py / mood_nlp_service.py already import torch
# behind a try/except ImportError and fall back to keyword/sklearn-based
# detection when it's absent (TRANSFORMERS_AVAILABLE=False), so installing
# bare torch with no transformers would only pay its full import RAM cost,
# in every gunicorn worker, for a feature that stays permanently disabled
# anyway. If a future plan upgrade re-enables semantic BERT detection,
# reinstate transformers+sentence-transformers in requirements.txt (torch
# comes in as their dependency) rather than installing torch standalone.

# Install all dependencies from requirements
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    portaudio19-dev \
    libasound2-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user BEFORE copying files so --chown is valid
RUN useradd --create-home --shell /bin/bash --uid 10000 app \
    && chown -R app:app /app

# Copy application code (user now exists, --chown resolves correctly)
COPY --chown=app:app . .

# Switch to non-root user
USER app

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# Use gunicorn for production. gunicorn_config.py is the SINGLE source of truth
# for worker/thread/timeout config AND the post_worker_init hook that starts the
# background services (crisis queue, schedulers) per worker. The previous inline
# args bypassed the config file, so those hooks never ran under Docker.
CMD ["gunicorn", "-c", "gunicorn_config.py", "main:app"]