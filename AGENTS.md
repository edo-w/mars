# Mars Agent Guide

This repository is prepared for agent-driven development. Agents should use
this file as the starting point for how work is organized, where
project-specific guidance lives, and which validation steps are required
before finishing a task.

## Where To Look First

- Project feature specs live in `features/`.
- Agent-specific skills live in `agents/skills/`.
- CLI source code lives in `src/`.
- The current package workflow is defined in `package.json`.

Before implementing a feature, read the relevant feature document in
`features/` if one exists. If no feature document exists yet, agents should
keep changes small and aligned with the existing conventions in this file and
the local skills.

## Local Skills

Agents should load the skill that matches the task before making changes.

- `agents/skills/typescript/SKILL.md`
  - TypeScript conventions for naming, imports, data contracts, Zod-backed
    record classes, and runtime shape validation.
- `agents/skills/testing/SKILL.md`
  - General testing conventions for Vitest, validation coverage, and test
    structure.
- `agents/skills/db-testing/SKILL.md`
  - Database-focused testing conventions for repo coverage, SQLite setup, and
    persistence behavior.
- `agents/skills/dependency-injection/SKILL.md`
  - Tiny DI container conventions for registration keys, lifetimes, scopes,
    modules, and `inject(...)`.
- `agents/skills/logtape/SKILL.md`
  - Logtape conventions for CLI logging, logger usage, and when `console.log`
    is acceptable.
- `agents/skills/cli-commands/SKILL.md`
  - Command structure conventions for flat command files, command factories,
    input classes, and handlers.
- `agents/skills/boot/SKILL.md`
  - Boot-layer conventions for startup wiring, initialization helpers, and
    keeping entrypoints thin.
- `agents/skills/commits/SKILL.md`
  - Conventional Commits conventions for commit message structure, types,
    scopes, and breaking changes.

If a task includes TypeScript implementation and tests, use both skills.
If a task includes repo or persistence tests, also use the DB testing skill.
If a task introduces or changes DI wiring, also use the dependency injection
skill.
If a task changes logging behavior, also use the Logtape skill.
If a task adds or updates CLI commands, also use the CLI commands skill.
If a task changes startup, wiring, or initialization, also use the boot skill.
If a task involves preparing or suggesting commits, also use the commits skill.

## Workflow

For every code change, agents should follow this order:

1. Read the relevant feature spec in `features/` when available.
2. Read the relevant local skill files in `agents/skills/`.
3. Implement the code change.
4. Run formatting when needed.
5. Run linting.
6. Run typescript checks.
7. Run tests.
8. Only finish once the change is validated or any remaining issue is clearly
   reported.

### Validation Notes

- `bun run lint` is the main Biome verification pass in this repository.
- `bun run lint` runs formatter, lint rules, and import organization together.
- `bun run fmt` is still available as a formatting-only pass when you want to
  clean up formatting without mixing in lint output.
- `bun run check` is the TypeScript checking pass.

## Required Commands

Use the Bun scripts below from the repository root:

- `bun run fmt`
- `bun run lint`
- `bun run check`
- `bun run test`

## Feature Workflow

New features should be documented before implementation.

- Store feature documents in `features/`.
- Use the naming format described in `features/README.md`.
- Treat the feature document as the implementation contract unless the user
  explicitly changes scope.

## Working Style

- Prefer small, incremental changes over broad speculative refactors.
- Preserve project conventions rather than introducing new patterns ad hoc.
- Keep markdown lines wrapped under 100 characters.
- If validation cannot be completed, report exactly which command failed and why.
