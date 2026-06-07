# Alembic

Database migrations are initialized in **Phase 1** per [`documents/database-design.md`](../documents/database-design.md).

The `versions/` directory is reserved for migration scripts. Dependencies (`alembic`, `psycopg[binary]`, `pgvector`) are already declared in [`api/pyproject.toml`](../api/pyproject.toml).
