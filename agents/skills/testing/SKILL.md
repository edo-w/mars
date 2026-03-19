# Testing Skill

Use this skill for any test work in this repository.

## Goals

- Validate runtime shape safety, not just happy-path behavior.
- Keep tests isolated, direct, and easy to scan.

## Test Stack

- Use Vitest for tests.
- Use `test`, `expect`, and `vi` from `vitest` as needed.
- App-side tests may use `assert(...)` when that keeps assertions simpler and
  more direct.

## Test File Naming

- Name test files after the source file they cover.
- Examples: `deploy-service.test.ts`, `config-record.test.ts`.

## Data Class And Record Class Tests

For every data class or record class:

- Add one positive test that constructs the class from valid input.
- Add one negative test that fails construction for invalid input.

This keeps the Zod schema and runtime validation behavior honest.

## Test Style

- Prefer flat tests and avoid nesting unless it is genuinely necessary.
- The test file is usually the natural grouping boundary.
- Prefer explicit assertion messages when the failure would otherwise be
  unclear.
- Prefer `vi.fn()` for simple collaborator test doubles.
- When the same mock shape is reused across multiple tests, extract a shared
  mock factory under the relevant test support folder.

## Test Structure

Follow the AAA pattern whenever practical:

1. Assemble.
2. Act.
3. Assert.

Keep these phases visually obvious in the test body.

## Validation

After changing tests or code covered by tests, run:

1. `bun run test`
