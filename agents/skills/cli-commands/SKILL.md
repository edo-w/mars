# CLI Commands Skill

Use this skill when adding or changing CLI commands in this repository.

## Goals

- Keep commands easy to find in a flat command folder.
- Separate command definition, input parsing, and execution clearly.
- Keep command assembly scalable as the CLI grows.

## File Layout

- Store command files under `src/commands/`.
- Keep the command list generally flat.
- Name command files by command purpose, for example:
  - `src/commands/ssh-key-create-command.ts`
  - `src/commands/ssh-key-get-command.ts`
- Use nested Commander subcommands for user-facing organization instead of
  deeply nested source folders.

## Command File Structure

Each command file should contain:

1. A command input class that parses and validates command data.
2. A `create...Command(...)` function that builds and configures the Commander
   `Command`.
3. A handler function that parses input, resolves dependencies, and performs
   the work.

## Input Class Rules

- Use a data class with a matching Zod schema for command input.
- Parse raw Commander options through the input class before using them.
- Keep command input validation at the command boundary.
- Use `snake_case` field names for command input objects when they represent
  validated contract data.

## Command Factory Rules

- Export a `create...Command(...)` function for each command file.
- Build the `Command` object inside that function.
- Set the description, options, and arguments there.
- Wire the action there by calling the handler function.
- Return the configured `Command`.

## Handler Rules

- The handler does the command work.
- Parse the raw options into the command input class first.
- In normal Mars code, the handler should use Tiny to resolve dependencies and
  services from the container.
- Keep DI resolution in the handler or in code called by the handler, not in
  the Commander wiring itself.
- Use Logtape via `getLogger(...)` inside the handler when command logging is
  needed.
- Keep logging setup outside the handler.

## Program Assembly

- Assemble top-level commands in a dedicated boot helper such as
  `src/boot/program.ts`.
- Create top-level namespaces with Commander subcommands.
- Add leaf commands from `src/commands/` into those subcommands.
- Return the fully configured root `Command`.

This pattern keeps the CLI scalable while preserving a flat command file list.

## Conventions

- Keep entrypoints thin and focused on bootstrapping.
- Keep command files focused on a single command.
- Prefer one input class per command.
- Prefer one handler per command.
- Prefer explicit command descriptions, options, and argument names.

## Validation

After changing command structure or command behavior, run:

1. `bun run fmt`
2. `bun run lint`
3. `bun run check`
4. `bun run test`
