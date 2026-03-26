# Testing Skill

Use this skill for any test work in this repository.

## Goals

- Validate runtime shape safety, not just happy-path behavior.
- Keep tests isolated, direct, and easy to scan.

## Test Stack

- Use Vitest for tests.
- Prefer flat `test(...)` blocks as the default test structure.
- Prefer `node:assert/strict` assertion functions over `expect(...)` style
  assertions for readability.
- Use `suite(...)` only when grouping adds real value beyond the test file
  itself.
- Use `vi` from `vitest` as needed.

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
- Do not add `describe(...)` blocks by default when the file already provides
  enough grouping context.
- Do not test logging output or logger call details unless logging behavior is
  itself the thing under test.
- Prefer assigning meaningful local variables before assertions instead of
  embedding boolean checks, lookups, or larger expressions directly inside the
  assertion call.
- Prefer explicit assertion messages when the failure would otherwise be
  unclear.
- Prefer `vi.fn()` for simple collaborator test doubles.
- Prefer real filesystem, socket, and process behavior when the test can stay
  simple and stable that way, instead of aggressively mocking imports or
  runtime modules.
- Prefer mocking small local abstractions such as `VlogManager` or `Tui`
  instead of mocking third-party package imports directly when the codebase
  already provides a wrapper.
- Use fake timers with `vi.useFakeTimers()` selectively for timer-driven
  behavior where they materially improve the test.
- Good fits for fake timers include idle timeout logic, retry or backoff loops,
  delayed shutdown, and other code where waiting in real time would make the
  test slow or flaky.
- Do not default to fake timers for ordinary tests that are already clear and
  reliable with real time.
- When the same mock shape is reused across multiple tests, extract a shared
  mock factory under the relevant test support folder.
- When multiple tests share the same object graph or service wiring, prefer a
  local `sut()` helper that returns the system under test plus the common
  collaborators the tests need.
- Keep the `sut()` helper focused on the shared object construction. Leave
  test-specific state and data setup inside the individual test unless it is
  truly identical everywhere.
- Place the `sut()` helper near the top of the test file before the tests so
  readers see the shared setup first and then the individual test cases.
- For module-local `sut()` helpers, prefer letting TypeScript infer the return
  shape instead of adding an inline object return annotation.
- If a shared test helper truly needs an explicit return type, define a
  separate interface instead of using an inline object type annotation.
- For reusable class-shaped mocks, prefer the `PublicLike<T>` pattern so tests
  implement the public contract of the real class without introducing duplicate
  source interfaces just for testing.
- Put reusable test mocks under `test/mocks/` and reusable helpers under
  `test/helpers/`.

## Test Structure

Follow the AAA pattern whenever practical:

1. Assemble.
2. Act.
3. Assert.

Keep these phases visually obvious in the test body.

## Validation

After changing tests or code covered by tests, run:

1. `bun run test`
