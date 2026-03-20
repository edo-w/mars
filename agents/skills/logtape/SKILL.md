# Logtape Skill

Use this skill when working with logging in this repository.

This project uses Logtape for application logging.

## Goals

- Use structured application logging consistently.
- Keep logging setup outside business logic and command handlers.
- Write directly to the console only when that is intentionally required.

## Core Rules

- Prefer Logtape over `console.log(...)`.
- Use `console.log(...)` only when code must write directly to the console
  surface for a specific reason.
- Do not pass `stdout` or `stderr` around command handlers and services as an
  ad hoc logging mechanism.
- Logging setup belongs in boot code, not in feature services or command
  handlers.
- Command handlers and services should only get a logger and use it.

## Logger Usage

- Import `getLogger` from `@logtape/logtape`.
- Create loggers with stable category arrays.
- Reuse categories that reflect the area of the app, command, or feature.
- Do not register loggers in Tiny by default; code that needs a logger should
  create it directly with `getLogger(...)`.

Example:

```ts
const logger = getLogger(['mars', 'ssh']);
```

## CLI Logging Setup

- Configure Logtape in `src/boot/`.
- Keep formatter, sink, and logger configuration in boot helpers.
- Call logging setup early in the app entrypoint before command execution.

Typical flow:

1. Configure logging in a boot helper such as `configureLogging()`.
2. Build app dependencies.
3. Create the program.
4. Parse and run the command.

## Formatting And Output

- Use Logtape sinks and formatters to control CLI output formatting.
- Keep timestamp, level, category, and message formatting in logging setup
  helpers.
- Do not duplicate formatting logic at individual callsites.

## Conventions

- Prefer `logger.info(...)`, `logger.warning(...)`, `logger.error(...)`, and
  related methods over console output.
- Keep categories intentional and stable.
- Do not make command handlers responsible for configuring Logtape.

## Validation

After changing logging behavior or logging setup, run:

1. `bun run fmt`
2. `bun run lint`
3. `bun run check`
4. `bun run test`
