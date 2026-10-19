# syntax=docker/dockerfile:1
# Honne Careers API: FastAPI + Tectonic in one image (plan v4 §1.5).
# Build:  docker build -t honne-api backend/
# The LaTeX package cache is baked in at build time; at runtime Tectonic runs offline.

# ---- 1. Python dependencies into a venv ----
FROM python:3.12-slim-bookworm AS builder
WORKDIR /build
RUN python -m venv /venv
COPY pyproject.toml ./
COPY app ./app
# Install the project to resolve its pinned deps, then drop the project itself:
# the app runs from /srv so it can find agents/ and prompts/ next to it.
RUN /venv/bin/pip install --no-cache-dir --upgrade pip \
 && /venv/bin/pip install --no-cache-dir . \
 && /venv/bin/pip uninstall -y honne-careers-backend

# ---- 2. Pinned Tectonic binary, checksum-verified ----
FROM debian:bookworm-slim AS tectonic
ARG TECTONIC_VERSION=0.15.0
ARG TECTONIC_SHA256=dfb82876f2986862996e564fa507a9e576e0c1e3bee63c2c1bd677c2543e6407
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL -o /tmp/tectonic.tar.gz \
      "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
 && echo "${TECTONIC_SHA256}  /tmp/tectonic.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/tectonic.tar.gz -C /usr/local/bin tectonic \
 && chmod 0755 /usr/local/bin/tectonic

# ---- 3. Runtime ----
FROM python:3.12-slim-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 --shell /usr/sbin/nologin app
COPY --from=builder /venv /venv
COPY --from=tectonic /usr/local/bin/tectonic /usr/local/bin/tectonic
ENV PATH=/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TECTONIC_CACHE_DIR=/opt/tectonic-cache \
    XDG_CACHE_HOME=/opt/tectonic-xdg
WORKDIR /srv
COPY app ./app
COPY agents ./agents
COPY prompts ./prompts
COPY docker ./docker

# Warm the cache by compiling the real Jake template once (needs network at build only).
# Packages land in TECTONIC_CACHE_DIR, the compiled format in XDG_CACHE_HOME/Tectonic/formats.
# Read-only for the runtime user: the app can't modify its own TeX packages or format.
RUN mkdir -p "$TECTONIC_CACHE_DIR" "$XDG_CACHE_HOME" \
 && python docker/warm_cache.py \
 && test -n "$(ls "$XDG_CACHE_HOME"/Tectonic/formats/*.fmt)" \
 && chmod -R a+rX,go-w "$TECTONIC_CACHE_DIR" "$XDG_CACHE_HOME"

USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"
# Render terminates TLS and is the only client of the container, so trust its forwarded headers.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]
