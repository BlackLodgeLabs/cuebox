## Summary

<!-- What does this PR change and why? -->

## Checklist

- [ ] `pytest` passes locally with `DATABASE_URL` set (`cd api && pytest tests/ -v`)
- [ ] CI workflow green (GitHub Actions `api-ci`)
- [ ] `ruff check app tests` passes (`cd api`)
- [ ] Bug fixes include a regression test (link to test file below)
- [ ] New provider→DB fields have CHECK-constraint edge-case tests

## Regression tests

<!-- Link test file(s) added or updated for bug fixes, e.g. api/tests/test_import_job_invariants.py -->
