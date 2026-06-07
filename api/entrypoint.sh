#!/bin/sh
set -e

until alembic upgrade head; do
  echo "Waiting for database and running migrations..."
  sleep 1
done

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
