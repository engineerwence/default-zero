FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# WEB_CONCURRENCY controls worker count — default 2, which fits comfortably on a small/free
# instance (512MB RAM). Bump this via env var once you're on a plan with more RAM/CPU;
# 4 workers on a 512MB instance can OOM-crash under real concurrent load, which defeats the point.
ENV WEB_CONCURRENCY=2
CMD uvicorn main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY}
