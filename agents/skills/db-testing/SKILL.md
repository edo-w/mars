# DB Testing Skill

Use this skill for repository, persistence, and database-backed tests.

## Goals

- Validate persistence behavior thoroughly.
- Keep repo tests isolated and deterministic.
- Verify database-facing contracts with realistic storage behavior.

## Repo Tests

For every public repo method:

- Add a corresponding test that exercises that method.
- Cover read methods such as `get`, `find`, or list queries.
- Cover write methods such as `insert`, `update`, and delete-like operations if
  they exist.

Repo tests may use direct SQL setup when that is the simplest way to create the
required preconditions.

## Database Test Setup

- Use SQLite in-memory databases for repo tests whenever possible.
- Run the migrator before each test to create the required schema.
- Keep repo tests isolated so each test gets its own database state.
- Use direct SQL setup sparingly and only for the exact state needed by the
  method under test.

## Validation

After changing repo or database-backed tests, run:

1. `bun run test`
