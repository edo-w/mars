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

- Use Bun's built-in SQLite driver through the local `DbClient` wrapper
  instead of talking to `bun:sqlite` directly from repo and service code.
- Use SQLite in-memory databases for repo tests whenever possible.
- Run the `DbMigrator` with the feature's migration list before each repo test
  so the schema is created the same way production code creates it.
- Keep repo tests isolated so each test gets its own database state.
- Use direct SQL setup sparingly and only for the exact state needed by the
  method under test.

## Conventions

- Keep database-facing models in a `*-models.ts` file for the feature area.
- Repos should return validated model objects instead of loose raw row shapes.
- Keep migration files under the feature's `migrations/` folder and name them
  `<date>-<name>.ts`.
- Use the shared `DbMigration` base class and `DbMigrator` instead of writing
  ad hoc migration loops inside feature services or repos.

## Validation

After changing repo or database-backed tests, run:

1. `bun run test`
