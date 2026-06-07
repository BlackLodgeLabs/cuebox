# Alembic

Database migrations live under [`api/alembic/`](../api/alembic/) with config at [`api/alembic.ini`](../api/alembic.ini).

Run from the `api/` directory:

```bash
cd api && alembic upgrade head
```

In Docker, migrations run via [`api/entrypoint.sh`](../api/entrypoint.sh) before uvicorn starts.
