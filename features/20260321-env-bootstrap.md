# Mars Environment Bootstrap

## Summary

Add `mars env bootstrap`.

This command bootstraps the centralized S3 bucket Mars uses for environment
work and persistent shared state.

The command works against:

- the currently selected environment
- or an explicit `--env` option

The `--env` option overrides the currently selected environment.

## Goals

- Let Mars bootstrap the shared environment bucket for an environment.
- Resolve the target environment from either local state or an explicit option.
- Support bucket-name templating from config so users can share buckets or
  isolate them per environment as needed.
- Ensure the bootstrap bucket is created with secure defaults.

## Non-Goals

- Managing multiple buckets for one environment.
- Bootstrapping anything other than S3 for this feature.
- Syncing Mars local state during bootstrap.
- Repairing or mutating an existing bucket when it already exists.
- Validating broader AWS account topology beyond the selected environment.

## Config Changes

### `mars.config.json`

Add a new config property:

```json
{
  "namespace": "app",
  "envs_path": "infra/envs",
  "work_path": ".mars",
  "env_bucket": "{env}-infra-{aws_account_id}"
}
```

### Property Rules

- `env_bucket` is a string template used to resolve the final S3 bucket name
  for the environment being bootstrapped.
- variable replacement happens at runtime against the resolved environment.
- `mars init` should write `"{env}-infra-{aws_account_id}"` as the default
  `env_bucket` value.

## Bucket Template Variables

The `env_bucket` template may use the following variables:

- `namespace`
  - project namespace from `mars.config.json`
- `env_name`
  - environment `name` only, without namespace prefix
- `env`
  - full environment id such as `gl-dev`
- `aws_account_id`
  - from `environment.yml`
- `aws_region`
  - from `environment.yml`

Example:

```json
{
  "env_bucket": "{env}-infra-{aws_account_id}"
}
```

For environment `gl-dev` in account `10000`, this resolves to:

```text
gl-dev-infra-10000
```

## Command

### `mars env bootstrap`

Bootstrap the S3 bucket Mars uses for the resolved environment.

### Options

- `--env <env>`
  - full environment id to bootstrap
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

## Bootstrap Behavior

Once the environment is resolved:

1. read `mars.config.json`
2. read `env_bucket`
3. replace all supported template variables using the resolved environment and
   Mars config
4. compute the final bucket name
5. check whether that S3 bucket already exists
6. if the bucket exists, print `s3 bucket "{bucket}" already exists` and exit
   without making changes
7. if the bucket does not exist, create it with the required secure defaults
8. after creating it, print `created s3 bucket "{bucket}"`

## Bucket Creation Requirements

When Mars creates the bucket, it must ensure:

- bucket is private
- all public access is blocked
- server-side encryption is enabled
- TLS enforcement is enabled

This is mandatory because the bucket holds sensitive Mars state and work data.

## Existing Bucket Behavior

If the bucket already exists:

- Mars exits successfully
- Mars does not attempt to mutate the bucket
- Mars does not repair missing settings in this feature
- Mars outputs:
  - `s3 bucket "{bucket}" already exists`

## Service And Code Structure

### App Services

Responsibilities:

- resolve the environment from explicit `--env` or selected state
- resolve the final bucket name from the `env_bucket` template
- check whether the S3 bucket exists
- create the bucket when missing
- enforce the required bucket security settings during creation

For now, keep this bootstrap behavior inside the existing
`EnvironmentService`.

### Command Wiring

- add `mars env bootstrap`
- the command should resolve the bootstrap service from Tiny
- environment lookup should reuse the existing environment and state services

### AWS Integration

- this feature introduces AWS-backed behavior
- install and use the AWS S3 client
- AWS credentials are expected to already be available in the process
  environment
- loading or sourcing AWS credentials is outside the scope of this feature
- S3 access should be isolated inside `EnvironmentService` for now
- command handlers should not call AWS directly

## Suggested Implementation Shape

- update `MarsConfig` to include `env_bucket`
- update `mars init` to write `env_bucket`
- add `mars env bootstrap`
- add environment-resolution flow for explicit `--env` override
- add bucket-name template resolution
- add S3 bucket existence check
- add S3 bucket creation with:
  - private access
  - block public access
  - SSE enabled
  - TLS enforcement

## Acceptance Criteria

- `mars init` writes `env_bucket`
- `mars env bootstrap` uses `--env` when passed
- `mars env bootstrap` falls back to selected environment when `--env` is not
  passed
- `mars env bootstrap` prints `no environment selected` when neither resolution
  path yields an environment
- `mars env bootstrap --env <env>` prints
  `environment "{env}" does not exists` when the environment is missing
- `env_bucket` variables resolve correctly from Mars config and
  `environment.yml`
- if the resolved bucket already exists, Mars prints
  `s3 bucket "{bucket}" already exists`
- if the resolved bucket does not exist, Mars creates it
- if Mars creates the bucket, Mars prints `created s3 bucket "{bucket}"`
- created buckets are private
- created buckets block all public access
- created buckets have SSE enabled
- created buckets enforce TLS
