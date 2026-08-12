# syntax=docker/dockerfile:1
# PBB FastAPI — Sranko ML (CPU torch). Mount models/use.pth at runtime.

FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY app ./app
COPY main.py ./

RUN pip install --no-cache-dir -U pip \
    && pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir .

ENV SRANKO_MODEL_PATH=/app/models/use.pth \
    PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8000/ml/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
