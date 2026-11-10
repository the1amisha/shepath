FROM python:3.12-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8011
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
RUN python -c "import osmium"
COPY backend/app /app/backend/app
COPY backend/preflight.py /app/backend/preflight.py
COPY data/ranchi_safety /app/data/ranchi_safety
RUN useradd --uid 10001 --create-home shepath
USER shepath
EXPOSE 8011
CMD ["sh", "-c", "python backend/preflight.py && exec python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port ${PORT} --workers 1 --limit-concurrency 32 --lifespan on"]
