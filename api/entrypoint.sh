#!/bin/sh
set -e

MAX_RETRIES=${ALEMBIC_MAX_RETRIES:-30}
SLEEP_SECONDS=${ALEMBIC_RETRY_SLEEP_SECONDS:-1}
attempt=1
until alembic upgrade head; do
  if [ "$attempt" -ge "$MAX_RETRIES" ]; then
    echo "Alembic upgrade failed after $attempt attempts; exiting."
    exit 1
  fi
  echo "Alembic not ready or migration failed (attempt $attempt/$MAX_RETRIES); retrying in ${SLEEP_SECONDS}s..."
  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
