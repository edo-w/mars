# Boot Skill

Use this skill when working with app startup, initialization, or top-level
wiring.

## Goals

- Keep setup and wiring code in a distinct boot layer.
- Keep entrypoints thin.
- Make startup behavior easy to reason about and easy to scale.

## Boot Folder

- Put startup helpers under the app-specific boot folder such as
  `src/cli/boot/`, `src/web/boot/`, or `src/service/boot/`.
- Use boot code for setup, initialization, and top-level wiring.
- Keep logging setup, config loading, dependency construction, DB setup, and
  program assembly in boot helpers when they belong to startup flow.

## Entrypoint Rules

- App or CLI entrypoints should mainly call boot helpers.
- Do not pack setup logic directly into the entrypoint file.
- The entrypoint should coordinate startup, command execution, and top-level
  error handling.

Typical shape:

1. Configure logging.
2. Build dependencies.
3. Create the program.
4. Parse and run the CLI.
5. Convert errors into an exit code.

## Conventions

- Keep boot helpers focused on one startup concern each.
- Keep boot code separate from business logic.
- Prefer boot helpers with explicit names such as `configureLogging()`,
  `createMarsDeps()`, or `createProgram()`.
- Use the boot layer as the place where app-wide wiring becomes explicit.
- Put feature or app behavior under the app layer such as `src/app/...`,
  not inside boot helpers.

## Validation

After changing startup or wiring behavior, run:

1. `bun run fmt`
2. `bun run lint`
3. `bun run check`
4. `bun run test`

