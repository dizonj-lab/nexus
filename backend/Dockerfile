# NEXUS API. Build from the repository root: docker build -f backend/Dockerfile .
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip install --upgrade pip && pip install .
COPY backend/agents ./agents
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./
COPY schema ./schema
RUN useradd -r -u 10001 nexus && chown -R nexus /srv
USER nexus
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/healthz')"
# Migrate, then serve. One worker: the login throttle is in memory (WP8 moves it to Redis).
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
