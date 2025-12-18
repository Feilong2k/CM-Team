# Backend - Orion System

## Database Migrations

### Overview
The migration system uses a custom Node.js script (`scripts/migrate.js`) to execute SQL migration files in timestamp order. Each migration runs in its own transaction (BEGIN/COMMIT/ROLLBACK).

### Migration Files
- Location: `backend/migrations/`
- Format: `TIMESTAMP_description.sql` (e.g., `001_initial.sql`, `002_orion_workflow.sql`)
- Content: Plain SQL statements

### NPM Scripts

#### Development Environment
```bash
npm run db:migrate
```
- Uses `DATABASE_URL` from `.env` file
- Runs all pending migrations
- Exits with code 0 on success, 1 on failure

#### Test/CI Environment
```bash
npm run db:migrate:test
```
- Sets `NODE_ENV=test` via cross-env
- Uses `DATABASE_URL` from environment variables
- Designed for CI/CD pipelines and test suites

### Environment Variables

#### Required
- `DATABASE_URL`: PostgreSQL connection string
  - Format: `postgresql://username:password@host:port/database`
  - Example: `postgresql://postgres:postgres@localhost:5432/appdb`

#### Optional
- `NODE_ENV`: Environment identifier (development, test, production)

### Execution Workflow

#### Development (Local)
1. **Who:** Developer / Orion local workflow
2. **When:** Before running integration tests or starting the application
3. **Trigger:** Manual execution via `npm run db:migrate`
4. **Safety:** `.env` file contains local DB credentials

#### CI/Test Environment
1. **Who:** CI job (Orion orchestrated)
2. **When:** Before integration tests in CI pipeline
3. **Trigger:** Automated as part of CI workflow
4. **Safety:** `DATABASE_URL` injected via CI secrets

#### Production Environment
1. **Who:** Release engineer / deployment pipeline
2. **When:** During deployment, before application start
3. **Trigger:** Manual approval or automated with safeguards
4. **Safety:** Production `DATABASE_URL` never stored in code

### Safety Rules

1. **Environment Selection:** `DATABASE_URL` is the sole selector of environment
2. **Never Auto-migrate on Startup:** Avoid automatic migrations in production
3. **Transaction Safety:** Each migration runs in its own transaction
4. **Error Handling:** Failed migrations rollback and exit with non-zero code
5. **Missing Environment:** Script fails gracefully with clear error message

### Error Messages

The migration runner provides clear error messages:

- **Missing DATABASE_URL:** "DATABASE_URL environment variable is required"
- **Invalid SQL:** "Migration 'filename.sql' failed: [error details]"
- **Missing migrations directory:** "Migrations directory not found: [path]"
- **No migration files:** "No .sql files found in [directory]"

### Integration with CI/CD

```yaml
# Example CI configuration
steps:
  - name: Run database migrations
    run: npm run db:migrate:test
    env:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  
  - name: Run tests
    run: npm test
```

### Best Practices

1. **Order Matters:** Migration files are executed in timestamp order
2. **Idempotency:** Write migrations that can run multiple times safely
3. **Rollback Consideration:** While each migration has rollback, consider data preservation
4. **Testing:** Always test migrations in a non-production environment first
5. **Backup:** Backup database before running production migrations

### Troubleshooting

**Q: Migration fails with "DATABASE_URL environment variable is required"**
A: Ensure `.env` file exists with DATABASE_URL or set it in environment

**Q: No migration files found warning**
A: Check that migration files exist in `backend/migrations/` with `.sql` extension

**Q: Migration fails with SQL error**
A: Check SQL syntax and ensure all dependencies (tables, columns) exist
