FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
COPY alembic.ini .
COPY alembic/ alembic/
COPY entrypoint.sh .
COPY app/ app/

RUN sed -i 's/\r$//' entrypoint.sh \
  && chmod +x entrypoint.sh \
  && pip install --no-cache-dir .

ENTRYPOINT ["./entrypoint.sh"]
CMD ["--reload"]
