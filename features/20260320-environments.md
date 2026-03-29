# Mars Environments And Local State

## Summary

Add environment management to Mars.

Environments are a core concept. Mars always operates against a current
environment, and an environment represents a deployable area where resources,
services, and applications are managed for end users.

Each environment belongs to exactly one AWS account. Multi-account and
multi-cloud environments are out of scope for now.

This feature also corrects previous naming:

- replace `stack_path` with `envs_path`
- treat environment discovery as driven by `environment.yml`

## Goals

- Introduce environments as a first-class Mars concept.
- Let Mars discover environments from disk.
- Let Mars create new environments from a standard template.
- Let Mars store and use a selected current environment.
- Keep environment state local to the operator and repository.
- Align service, VFS, and test patterns with the current repo conventions.

## Non-Goals

- Multi-account environments.
- Multi-cloud environments.
- Syncing selected environment state to S3.
- Environment deletion.
- Editing existing environment metadata through Mars commands.
- Deep AWS validation of account IDs or regions during create.

## Environment Model

### Identity

Each environment has:

- `namespace`
- `name`

Example:

- `gl-dev`
  - `namespace=gl`
  - `name=dev`

This naming pattern is intended to flow into Terraform-managed resources so
they can avoid collisions and remain attributable to a specific environment and
manager.

### Cloud Scope

- An environment always maps to exactly one AWS account.
- Mars only supports AWS environments right now.

### Environment Config File

An environment exists when a folder contains `environment.yml`.

This file is used both by Terragrunt and by Mars to identify and load
environment configuration.

Required schema:

```yaml
name: string
namespace: string
aws_account_id: string
aws_region: string
```

These fields are required because they drive other configuration, including
Terraform state and Mars infrastructure bucket behavior.

## Config Changes

### mars.config.json

Update the Mars config contract:

- replace `stack_path` with `envs_path`
- add `namespace`
- keep `work_path`

Expected config shape:

```json
{
  "namespace": "app",
  "envs_path": "infra/envs",
  "work_path": ".mars"
}
```

### Property Rules

- `namespace` is required configuration and defaults to `app` when init creates
  the file.
- `envs_path` is required configuration and defaults to `infra/envs` when init
  creates the file.
- `work_path` remains optional at the product level and defaults to `.mars`.
- `mars init` should write all three values explicitly into the generated
  config file.

## Environment Discovery

### Search Root

Mars uses `envs_path` as the root directory for environment discovery.

### Directory Shape

The `envs_path` structure is flat.

Mars iterates the top-level directories under `envs_path` and checks whether
each one contains an `environment.yml` file.

If a folder contains `environment.yml`, Mars treats it as an environment.

### Example

```text
infra/envs/
  dev/
    environment.yml
  test/
    environment.yml
```

This produces two environments.

## Mars State

### File

Mars keeps local operator state in:

```text
.mars/state.json
```

This state is local-only and does not sync to S3.

### Initial State Shape

```json
{
  "selected_environment": "infra/envs/dev/environment.yml"
}
```

### Rules

- `selected_environment` stores the path to the selected environment's
  `environment.yml` file.
- The path is relative to the repository root.
- State read and write behavior must go through `StateService`.

## Commands

### `mars env list`

Shows a list of environments discovered under `envs_path`.

Output rules:

- one environment per line
- two columns:
  - environment id
  - relative path to `environment.yml`
- prefix the environment id with `*` when it is the currently selected
  environment

Example:

```text
* gl-dev  infra/envs/dev/environment.yml
  gl-test infra/envs/test/environment.yml
```

### `mars env show <name?>`

Shows detailed information for an environment.

Output fields:

- path to environment folder relative to repo root
  - example: `./infra/envs/dev`
- name
- namespace
- aws_account_id
- aws_region

Behavior:

- if `name` is provided, treat it as the full environment id such as `gl-dev`
  and show that environment
- if `name` is omitted, show the current selected environment
- if there is no selected environment, output:
  - `no environment selected`
- if the requested environment does not exist, output:
  - `environment "{name}" not found`

### `mars env create <name>`

Creates a new environment folder and `environment.yml` file.

Behavior:

- `name` is the command argument
- `namespace` comes from `mars.config.json`
- `aws_account_id` defaults to `TODO`
- `aws_region` defaults to `TODO`
- if the environment already exists, output:
  - `environment "{name}" already exists`

Expected created file:

```yaml
name: dev
namespace: app
aws_account_id: TODO
aws_region: TODO
```

### `mars env select <name?>`

Selects the current environment for future Mars operations.

Behavior:

- store the selection in `.mars/state.json`
- selected value must be the relative path to the environment's
  `environment.yml`
- if `name` is provided, treat it as the full environment id such as `gl-dev`
- if `name` is omitted, show an interactive CLI TUI selection so the operator
  can use autocomplete or arrow keys to select an environment
- the interactive selection list should display full environment ids, not just
  the short environment `name`

## Service And Code Structure

### App Services

Create the following services under `src/app`:

- `StateService`
- `EnvironmentService`

Responsibilities:

- `StateService` owns all Mars state reads and writes
- `EnvironmentService` owns environment discovery, show, create, and select
- `EnvironmentService` must use `StateService` for environment-selection state

### Command Wiring

- env commands should resolve services from the Tiny container
- commands should not implement environment behavior directly
- use `enquirer` for the interactive `mars env select` picker

### VFS Pattern

- use the `Vfs` class as the Tiny resolve key directly
- create the real VFS in container setup with a factory function
- `Vfs` owns `cwd`
- all state and environment file operations should go through `Vfs`

### Test Mock Pattern

Use this pattern for public class contracts in tests:

```ts
type PublicLike<T> = {
  [K in keyof T]: T[K];
};
```

Example:

```ts
type VfsLike = PublicLike<Vfs>;
```

This allows tests to define `MockVfs` against the public shape of `Vfs`
without introducing separate contract interfaces just for tests.

### Test Utilities

- rename `FakeVfs` to `MockVfs`
- move reusable mocks to `test/mocks/mock-vfs.ts`
- move reusable JSON helpers to `test/helpers/json.ts`

## Suggested Implementation Shape

- update boot config loading to support `namespace`, `envs_path`, and
  `work_path`
- update `mars init` to write the new config shape
- add `StateService`
- add `EnvironmentService`
- add environment command group under CLI commands
- add VFS-backed state persistence in `.mars/state.json`
- update tests to use `PublicLike<T>`-based mocks and shared helpers

## Acceptance Criteria

- `mars init` writes `namespace`, `envs_path`, and `work_path`
- `mars init` defaults `namespace` to `app`
- `mars init` defaults `envs_path` to `infra/envs`
- Mars discovers environments by top-level `environment.yml` files under
  `envs_path`
- `mars env list` shows discovered environments
- `mars env show` shows the selected environment when no name is provided
- `mars env show` prints `no environment selected` when no selection exists
- `mars env show <name>` prints `environment "{name}" not found` when missing
- `mars env create <name>` creates the folder and `environment.yml`
- `mars env create <name>` uses config namespace and `TODO` defaults for AWS
  values
- `mars env create <name>` prints `environment "{name}" already exists` when
  the environment is already present
- `mars env select <name>` stores the selected environment path in
  `.mars/state.json`
- `mars env select` without a name opens an interactive selection UI
- all state reads and writes go through `StateService`
- all environment file operations go through `Vfs`
- tests use `MockVfs` and `PublicLike<T>`-based mocking patterns
