# Mars Environment Destroy

## Summary

Add `mars env destroy`.

This command destroys Mars-managed environment resources for the resolved
environment.

For this feature, the command only manages the environment S3 bucket created by
Mars.

Terraform-managed infrastructure is explicitly out of scope and is handled
outside of Mars.

This feature also adds a small improvement to `mars env show` so the resolved
environment bucket name is displayed as part of the environment details.

## Goals

- Let operators destroy Mars-managed environment resources intentionally.
- Require explicit interactive confirmation before destruction.
- Reuse the same environment-resolution and bucket-template logic as
  bootstrap.
- Empty the bucket before deleting it when objects are present.
- Extend `mars env show` so operators can see the resolved environment bucket
  name.

## Non-Goals

- Destroying Terraform-managed resources.
- Destroying non-Mars resources in the AWS account.
- Deleting the environment folder or `environment.yml`.
- Clearing Mars state automatically after destroy.
- Supporting non-interactive forced deletion in this feature.

## Command

### `mars env destroy`

Destroy Mars-managed resources for the resolved environment.

### Options

- `--env <env>`
  - full environment id to destroy
  - overrides the selected environment

### Environment Resolution

The command resolves the target environment in this order:

1. the `--env` option when provided
2. the currently selected environment from Mars state

### Resolution Errors

- if no environment is selected and `--env` is not passed, output:
  - `no environment selected`
- if `--env` is passed and that environment does not exist, output:
  - `environment "{env}" does not exists`

## Interactive Confirmation

This command is always interactive because it is destructive.

Before deleting anything, Mars must display a confirmation summary like:

```text
you are about to delete the environment "{env}"

- resource 1
- resource 2

to confirm please enter the environment name:
```

### Confirmation Rules

- Mars must list every resource it intends to destroy.
- for this feature, the resource list contains the environment S3 bucket
- the operator must enter the exact environment id such as `gl-dev`
- if the confirmation text does not exactly match the environment id, Mars must
  abort without deleting resources and print:
  - `invalid environment id`

## Destroy Behavior

Once the environment is resolved and confirmed:

1. read `mars.config.json`
2. resolve `env_bucket` using the same variable replacement rules used by
   bootstrap
3. compute the final bucket name
4. check whether that S3 bucket exists
5. if the bucket does not exist, print `s3 bucket "{bucket}" not found` and
   exit successfully
6. if the bucket exists and is not empty, empty it
7. delete the bucket
8. after all resources are destroyed, print
   `environment "{env}" destroyed successfully`

## Bucket Deletion Rules

- if the bucket contains objects, Mars must remove them before deleting the
  bucket
- deletion applies only to the Mars environment bucket for this feature
- if the bucket does not exist, the command should be idempotent and exit
  successfully
- as Mars performs destroy actions, it should print progress lines such as:
  - `remove s3 bucket "{bucket}"`

## `mars env show` Sidecar Change

Update `mars env show <name?>` so it also displays:

- `env_bucket`

The value should be the fully resolved bucket name for the shown environment,
not the raw `env_bucket` template string from config.

Example additional output field:

```text
env_bucket: gl-dev-infra-10000
```

## Service And Code Structure

### App Services

Keep destroy behavior inside the existing `EnvironmentService`.

Responsibilities:

- resolve the environment from explicit `--env` or selected state
- resolve the final bucket name from the `env_bucket` template
- list the resources that will be destroyed
- empty the bucket when needed
- delete the bucket
- expose the resolved bucket name for `mars env show`

### Command Wiring

- add `mars env destroy`
- keep the command handler responsible for interactive confirmation
- keep AWS deletion behavior inside `EnvironmentService`

### AWS Integration

- use the AWS S3 client already introduced for bootstrap
- credentials continue to be expected from the process environment
- credential loading remains out of scope

## Suggested Implementation Shape

- add `mars env destroy`
- reuse environment-resolution behavior from bootstrap
- reuse bucket-name template resolution from bootstrap
- add bucket-emptying behavior before deletion
- add bucket deletion behavior
- add a helper or service method that returns the destroy resource list for
  confirmation
- update `mars env show` to display the resolved `env_bucket`

## Acceptance Criteria

- `mars env destroy` uses `--env` when passed
- `mars env destroy` falls back to selected environment when `--env` is not
  passed
- `mars env destroy` prints `no environment selected` when neither resolution
  path yields an environment
- `mars env destroy --env <env>` prints
  `environment "{env}" does not exists` when the environment is missing
- `mars env destroy` always prompts for interactive confirmation
- `mars env destroy` requires the exact environment id as confirmation text
- `mars env destroy` lists the resources it will destroy before asking for
  confirmation
- if the bucket exists and has objects, Mars empties it before deletion
- if the bucket exists, Mars deletes it after confirmation
- if the bucket does not exist, Mars prints `s3 bucket "{bucket}" not found`
- after all resources are destroyed, Mars prints
  `environment "{env}" destroyed successfully`
- `mars env show` displays the resolved `env_bucket` value
