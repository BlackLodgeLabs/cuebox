FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
COPY alembic.ini .
COPY alembic/ alembic/
COPY entrypoint.sh .
COPY app/ app/

RUN pip install --no-cache-dir . && chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
CMD ["--reload"]
