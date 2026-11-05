FROM python:3.14.9-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN apt-get update \
    && apt-get install --no-install-recommends -y build-essential \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system app \
    && adduser --system --ingroup app app

COPY src ./src
COPY assets ./assets
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY scripts ./scripts

ENV PYTHONPATH=/app/src
USER app

CMD ["python", "-m", "orla_bot"]
