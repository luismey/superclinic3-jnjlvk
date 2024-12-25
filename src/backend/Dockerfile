# syntax=docker/dockerfile:1.4

# ===== Builder Stage =====
FROM python:3.11-slim AS builder

# Set build environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory and set permissions
WORKDIR /build
RUN useradd -u 1000 -r appuser && \
    chown appuser:appuser /build

# Install Python dependencies
COPY --chown=appuser:appuser requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ===== Final Stage =====
FROM python:3.11-slim

# Set runtime environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    WORKERS_PER_CORE=1 \
    MAX_WORKERS=16 \
    TIMEOUT=120 \
    KEEP_ALIVE=5 \
    GRACEFUL_TIMEOUT=30

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -u 1000 -r appuser

# Create necessary directories with proper permissions
WORKDIR /app
RUN mkdir -p /app/logs && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /app

# Copy Python dependencies from builder
COPY --from=builder --chown=appuser:appuser /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=builder --chown=appuser:appuser /usr/local/bin/ /usr/local/bin/

# Copy application code
COPY --chown=appuser:appuser . .

# Set proper file permissions
RUN chmod -R 755 /app && \
    chmod -R 777 /app/logs

# Configure container health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1

# Set resource limits
ENV GUNICORN_CMD_ARGS="--workers=${MAX_WORKERS} --worker-tmp-dir=/dev/shm --worker-class=uvicorn.workers.UvicornWorker --timeout=${TIMEOUT} --keep-alive=${KEEP_ALIVE} --graceful-timeout=${GRACEFUL_TIMEOUT} --limit-request-line=8190"

# Expose application port
EXPOSE 8000

# Switch to non-root user
USER appuser

# Start Gunicorn server
ENTRYPOINT ["gunicorn"]
CMD ["-c", "gunicorn.conf.py", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--access-logfile", "/app/logs/access.log", "--error-logfile", "/app/logs/error.log", "main:app"]

# Set resource limits
LABEL org.opencontainers.image.memory="2G" \
      org.opencontainers.image.cpus="2.0" \
      org.opencontainers.image.pids="100"