# Commits Skill

Use this skill when preparing, suggesting, or reviewing commit messages in this
repository.

This project uses Conventional Commits and enforces commit message linting with
Lefthook and commitlint.

Source:

- https://www.conventionalcommits.org/en/v1.0.0/

## Goals

- Keep commit messages consistent and machine-readable.
- Make the intent of each commit obvious from the title.
- Support changelog generation and release tooling cleanly.

## Basic Structure

Use this shape:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Core Rules

- Always start the title with a commit `type`.
- Add an optional scope in parentheses when it helps identify the affected
  area.
- Follow the type or type-plus-scope with `: ` and a short description.
- Put the body one blank line below the title when extra context is needed.
- Put footers one blank line below the body.
- Use `BREAKING CHANGE:` in the footer for breaking changes when appropriate.
- A breaking change may also be marked with `!` before the colon.

## Common Types

Use the standard Conventional Commits types already supported by the project
tooling:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `build`
- `ci`
- `chore`
- `perf`
- `style`
- `revert`

## Type Guidance

- Use `feat` for a new feature.
- Use `fix` for a bug fix.
- Use `docs` for documentation-only changes.
- Use `refactor` for code changes that are not features or bug fixes.
- Use `test` for test-only changes.
- Use `build` for build system or dependency-related changes.
- Use `ci` for CI workflow changes.
- Use `chore` for general maintenance work that does not fit better elsewhere.
- Use `perf` for performance improvements.
- Use `style` for formatting or style-only changes with no behavior change.
- Use `revert` when reverting an earlier change.

## Scope Guidance

- Use a noun for the scope when it adds useful context.
- Keep scopes short and tied to a real area of the codebase.
- Examples: `cli`, `boot`, `commands`, `logging`, `config`.

## Description Guidance

- Keep the description short and specific.
- Describe what changed, not the whole backstory.
- Avoid vague titles such as `misc fixes` or `updates`.
- Prefer one logical change per commit whenever possible.

## Breaking Changes

- Mark breaking changes with `!` in the title, a `BREAKING CHANGE:` footer, or
  both.
- Use the footer when the reader needs a clear explanation of the break.

## Issue References

- Use commit footers to reference related issues when working on features or
  fixes tied to tracked work.
- Use `Closes: #10` or `Closes: #10, #15` when the commit should automatically
  close those issues after the commit lands in the relevant branch.
- Keep issue-closing references in the footer section, not in the title.

Examples:

```text
feat(cli): add workspace init command
```

```text
fix(config): handle missing workspace_name
```

```text
feat!: rename deployment config fields

BREAKING CHANGE: deployment_name is now service_name in config files
```

```text
feat(commands): add deploy status command

Closes: #10, #15
```

## Conventions

- Keep commit types consistent and lowercase.
- Keep scopes lowercase when used.
- Split unrelated changes into separate commits when practical.
- If a commit seems to match multiple types, prefer making multiple commits.
