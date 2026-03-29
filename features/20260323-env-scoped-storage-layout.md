# Mars Environment-Scoped Storage Layout

## Summary

Refactor Mars local cache paths and S3 object paths so environment-scoped
artifacts always live under an explicit environment segment.

This change prevents collisions when operators switch environments and also
allows a single S3 bucket to safely hold Mars-managed artifacts for multiple
environments.

This feature updates the SSH CA storage layout first and establishes the
environment-scoped path convention for future per-environment cached files.

## Goals

- Prevent local cache collisions between environments.
- Prevent S3 object collisions when multiple environments share the same bucket.
- Establish one consistent environment-scoped storage convention for future
  Mars features.
- Keep the current SSH CA feature behavior intact while changing only the path
  layout.

## Non-Goals

- Changing the environment bucket naming logic.
- Changing how environments are resolved.
- Changing SSH CA command semantics.
- Migrating existing remote or local artifacts automatically unless explicitly
  defined in this feature.

## New Path Convention

Mars should store environment-scoped artifacts under:

- local:
  - `<work_path>/env/{env}/...`
- S3:
  - `mars/env/{env}/...`

Where `{env}` is the full environment id such as `gl-dev`.

This layout becomes the standard base prefix for any future
environment-specific Mars artifact.

## SSH CA Path Changes

### Local Work Path

Change SSH CA local cache paths from:

- `<work_path>/ssh/ca/<name>_ca_ed25519.key`
- `<work_path>/ssh/ca/<name>_ca_ed25519.pub`

To:

- `<work_path>/env/{env}/ssh/ca/<name>_ca_ed25519.key`
- `<work_path>/env/{env}/ssh/ca/<name>_ca_ed25519.pub`

### S3 Paths

Change SSH CA S3 object paths from:

- `mars/ssh/ca/<name>_ca_ed25519.key`
- `mars/ssh/ca/<name>_ca_ed25519.pub`

To:

- `mars/env/{env}/ssh/ca/<name>_ca_ed25519.key`
- `mars/env/{env}/ssh/ca/<name>_ca_ed25519.pub`

## Affected Commands

This refactor affects all existing SSH CA commands:

- `mars ssh ca list`
- `mars ssh ca show [name]`
- `mars ssh ca create [name]`
- `mars ssh ca pull [name]`
- `mars ssh ca clear <name>`
- `mars ssh ca destroy <name>`

## Behavioral Expectations

### `mars ssh ca list`

- list only the SSH CAs for the resolved environment
- use the new S3 prefix:
  - `mars/env/{env}/ssh/ca/`

### `mars ssh ca show [name]`

- show the new S3 paths for the resolved environment
- `public_key` and `private_key` should point at the new environment-scoped S3
  locations

### `mars ssh ca create [name]`

- create the local cached files under the new environment-scoped local path
- upload the files under the new environment-scoped S3 path
- local existence checks must only consider the resolved environment's local
  folder
- S3 existence checks must only consider the resolved environment's S3 prefix

### `mars ssh ca pull [name]`

- pull into the new environment-scoped local path
- only check for files in the resolved environment's S3 prefix

### `mars ssh ca clear <name>`

- clear only the local cached files for the resolved environment
- it must not clear another environment's local SSH CA files

### `mars ssh ca destroy <name>`

- remove only the S3 objects for the resolved environment
- remove only the local cached files for the resolved environment
- confirmation output must list the new environment-scoped paths

## Future Convention

Any future Mars feature that stores environment-scoped artifacts locally or in
S3 should use the same base layout:

- local:
  - `<work_path>/env/{env}/...`
- S3:
  - `mars/env/{env}/...`

This should be treated as a repo convention after this feature lands.

## Service And Code Structure

### SSH CA Service

Keep the refactor inside the existing:

- `src/app/ssh-ca/SshCaService`

Update the path helpers there, or in the SSH CA shapes/helpers, so all SSH CA
commands inherit the new layout automatically.

### Environment Resolution

Use the already-resolved environment id to build the local and S3 paths.

Do not infer the environment segment from selected state alone when an explicit
environment is already resolved.

## Suggested Implementation Shape

- add reusable helpers for the environment-scoped base paths
- update SSH CA local-path helpers to include `env/{env}`
- update SSH CA S3-path helpers to include `mars/env/{env}`
- update all SSH CA operations to pass the resolved environment id into path
  construction
- update destroy confirmation resource labels to use the new paths
- update tests to validate that local and S3 paths are isolated per environment

## Acceptance Criteria

- SSH CA local cache paths include `env/{env}`
- SSH CA S3 paths include `mars/env/{env}`
- switching environments no longer risks local SSH CA cache collisions
- sharing a bucket across environments no longer risks SSH CA object collisions
- `mars ssh ca list` only lists keys from the resolved environment prefix
- `mars ssh ca show [name]` displays the new environment-scoped S3 paths
- `mars ssh ca create [name]` reads and writes only the resolved environment's
  local and S3 paths
- `mars ssh ca pull [name]` reads from the resolved environment's S3 prefix and
  writes to the resolved environment's local path
- `mars ssh ca clear <name>` only clears local cache files for the resolved
  environment
- `mars ssh ca destroy <name>` only removes local and S3 files for the
  resolved environment
- destroy confirmation output shows the new environment-scoped resource paths

