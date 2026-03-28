# Mars SSH CA Management

## Summary

Add SSH certificate authority management under `mars ssh ca`.

This feature lets operators create, list, inspect, pull, clear, and destroy
SSH certificate authority keypairs for a resolved Mars environment.

Each environment has its own isolated SSH CA material stored in that
environment's Mars S3 bucket.

Mars stores the SSH CA in S3 as the durable source of truth and may pull the
keypair into the local Mars work directory when local access is needed.

## Goals

- Let operators manage environment-scoped SSH CA keypairs through Mars.
- Persist SSH CA keypairs in the environment S3 bucket.
- Cache SSH CA keypairs locally under `work_path` when needed.
- Require an explicit passphrase when creating private keys.
- Require interactive confirmation before destructive deletion.
- Keep the command behavior aligned with the existing environment-resolution
  pattern used by other Mars commands.

## Non-Goals

- Issuing SSH certificates in this feature.
- Loading the SSH CA passphrase from environment variables in this feature.
- Integrating SSH CA material into cloud-init in this feature.
- Supporting multiple clouds or multiple accounts per environment.
- Managing non-Mars SSH keys or arbitrary SSH key material.

## Command Group

Add a new command group:

```text
mars ssh ca
```

Subcommands:

- `mars ssh ca list`
- `mars ssh ca show [name]`
- `mars ssh ca create [name]`
- `mars ssh ca destroy <name>`
- `mars ssh ca pull [name]`
- `mars ssh ca clear <name>`

## Naming

- SSH CA name defaults to `default` when the command accepts an optional name
  and no name is passed
- `destroy` and `clear` require an explicit name
- the CA key filenames use the CA name directly

Examples:

- `default_ca_ed25519.key`
- `default_ca_ed25519.pub`
- `deploy_ca_ed25519.key`
- `deploy_ca_ed25519.pub`

## Environment Resolution

The following commands operate on an environment and must support:

- the selected environment from Mars state
- `--env <env>` as an override using the full environment id

Commands:

- `mars ssh ca list`
- `mars ssh ca show [name]`
- `mars ssh ca create [name]`
- `mars ssh ca pull [name]`
- `mars ssh ca clear <name>`
- `mars ssh ca destroy <name>`

Resolution order:

1. `--env <env>` when provided
2. the currently selected environment

Resolution errors:

- if no environment is selected and `--env` is not passed, print:
  - `no environment selected`
- if `--env` is passed and that environment does not exist, print:
  - `environment "{env}" does not exists`

## Storage Layout

### S3

SSH CA files are stored in the environment S3 bucket under:

- private key:
  - `mars/ssh/ca/<name>_ca_ed25519.key`
- public key:
  - `mars/ssh/ca/<name>_ca_ed25519.pub`

### Local Work Path

When Mars pulls the SSH CA locally, it stores it under:

- private key:
  - `<work_path>/ssh/ca/<name>_ca_ed25519.key`
- public key:
  - `<work_path>/ssh/ca/<name>_ca_ed25519.pub`

This local copy is a workspace cache and is not the durable source of truth.

## Key Creation

`mars ssh ca create [name]` creates a new Ed25519 SSH CA keypair.

Rules:

- if `name` is omitted, use `default`
- Mars must prompt the operator for the private key passphrase
- Mars must create the keypair locally first
- Mars should use `ssh-keygen` on the system to generate the keypair
- the generated key comment should be:
  - `mars <name> ssh ca`
- Mars must upload both files to the environment S3 bucket
- Mars may keep the local files in `work_path` after creation
- if the local keypair already exists under `work_path`, Mars should treat that
  as already existing and abort without checking S3
- if the SSH CA already exists in S3, Mars must abort and print:
  - `ssh ca "{name}" already exists`

The created files must be:

- `<name>_ca_ed25519.key`
- `<name>_ca_ed25519.pub`

## Commands

### `mars ssh ca list`

List all SSH CA names for the resolved environment.

Behavior:

- enumerate SSH CA public keys under `mars/ssh/ca/`
- infer the SSH CA names from `<name>_ca_ed25519.pub`
- output one CA name per line

If no SSH CAs exist, the command exits successfully with no output.

### `mars ssh ca show [name]`

Show details for an SSH CA in the resolved environment.

If `name` is omitted, use `default`.

Output fields:

- `name`
- `public_key`
- `private_key`
- `create_date`

Expected values:

- `name`: SSH CA name
- `public_key`: S3 path to the public key object
- `private_key`: S3 path to the private key object
- `create_date`: creation date from the private key object

If the SSH CA does not exist, print:

- `ssh ca "{name}" does not exists`

### `mars ssh ca create [name]`

Create a new SSH CA for the resolved environment.

If `name` is omitted, use `default`.

If the SSH CA already exists, print:

- `ssh ca "{name}" already exists`

### `mars ssh ca destroy <name>`

Destroy an SSH CA for the resolved environment.

Rules:

- `name` is required
- Mars must remove both key files from S3
- Mars must also remove the local key files under `work_path` if present
- this command must always prompt for confirmation
- the operator must enter the exact SSH CA name to confirm deletion

If the SSH CA cannot be found, print:

- `ssh ca "{name}" not found`

### `mars ssh ca pull [name]`

Pull an SSH CA from S3 into the local Mars work directory.

If `name` is omitted, use `default`.

Behavior:

- fetch the private key and public key from S3
- ensure the local destination directory exists
- write the files into `<work_path>/ssh/ca/`
- if one or more expected S3 objects are missing, Mars must abort and print:
  - `ssh ca "{name}" corrupted. the following files missing in s3`
- after that message, Mars must list the missing files
- operators are expected to restore the missing files manually outside Mars

### `mars ssh ca clear <name>`

Clear a local SSH CA copy from the Mars work directory.

Rules:

- `name` is required
- clear the local private key if present
- clear the local public key if present
- if neither file exists locally, exit successfully without output

## Destroy Confirmation

`mars ssh ca destroy <name>` is always interactive.

Before deleting anything, Mars must display a confirmation summary like:

```text
you are about to delete the ssh ca "{name}"

the following resources will be destroyed

- s3 object "mars/ssh/ca/<name>_ca_ed25519.key"
- s3 object "mars/ssh/ca/<name>_ca_ed25519.pub"
- local file "<work_path>/ssh/ca/<name>_ca_ed25519.key"
- local file "<work_path>/ssh/ca/<name>_ca_ed25519.pub"

to confirm please enter the ssh ca name:
```

Confirmation rules:

- Mars must list all resources it intends to remove
- the operator must enter the exact SSH CA name
- if the confirmation text does not match, Mars must abort and print:
  - `invalid ssh ca name`

## S3 Paths

For a resolved environment bucket `{bucket}` and CA name `{name}`:

- public key S3 path:
  - `s3://{bucket}/mars/ssh/ca/{name}_ca_ed25519.pub`
- private key S3 path:
  - `s3://{bucket}/mars/ssh/ca/{name}_ca_ed25519.key`

## Local Paths

For a configured `work_path` and CA name `{name}`:

- public key local path:
  - `<work_path>/ssh/ca/{name}_ca_ed25519.pub`
- private key local path:
  - `<work_path>/ssh/ca/{name}_ca_ed25519.key`

## Future Passphrase Note

This feature only creates, stores, pulls, and clears SSH CA key material.

Future certificate issuance will use:

- the private key loaded from `work_path`
- a passphrase read from an environment variable named:
  - `MARS_SSH_CA_<name>_PASS`

The passphrase must not be persisted by Mars to disk.

## Service And Code Structure

### App Services

Add SSH CA behavior under the CLI app layer in:

- `src/cli/app/ssh-ca`

Use:

- `SshCaService`

Suggested responsibilities:

- resolve the target environment
- resolve the environment bucket name
- map CA names to S3 object keys and local file paths
- create and upload CA keypairs
- list SSH CAs from S3
- inspect SSH CA metadata from S3
- pull SSH CA files into `work_path`
- clear local cached SSH CA files
- destroy SSH CA files from S3 and local cache

### Command Wiring

Add a new command tree:

- `mars ssh`
- `mars ssh ca`
- CA subcommands under that group

Keep interactive prompting in the command handlers.

Keep S3 and filesystem operations in the app service.

### AWS Integration

- reuse the environment bucket resolution logic already present in
  `EnvironmentService`
- use the AWS S3 client for object listing, metadata reads, uploads, downloads,
  and deletes
- AWS credentials are expected to already be available in the process
  environment

### Key Generation

Use standard SSH tooling to generate the Ed25519 CA keypair with a passphrase.

The generated private key must be passphrase-protected.

Use `ssh-keygen` and set the key comment to:

- `mars <name> ssh ca`

## Suggested Implementation Shape

- add `mars ssh` and `mars ssh ca` command groups
- add `src/cli/app/ssh-ca/SshCaService`
- add reusable helpers for SSH CA filenames and paths
- implement environment resolution using the existing environment-selection
  rules
- implement S3 object listing for `list`
- implement S3 metadata lookup for `show`
- implement passphrase prompt and local key generation for `create`
- implement S3 upload for `create`
- implement S3 download for `pull`
- implement local-only cache clearing for `clear`
- implement interactive confirmation and S3 plus local deletion for `destroy`

## Acceptance Criteria

- `mars ssh ca list` lists SSH CA names for the resolved environment
- `mars ssh ca list` supports selected environment and `--env <env>`
- `mars ssh ca show [name]` defaults to `default`
- `mars ssh ca show [name]` prints the SSH CA details for the resolved
  environment
- `mars ssh ca show [name]` prints `ssh ca "{name}" does not exists` when the
  SSH CA is missing
- `mars ssh ca create [name]` defaults to `default`
- `mars ssh ca create [name]` prompts for a passphrase
- `mars ssh ca create [name]` creates a passphrase-protected Ed25519 keypair
- `mars ssh ca create [name]` uses `ssh-keygen`
- `mars ssh ca create [name]` sets the key comment to `mars <name> ssh ca`
- `mars ssh ca create [name]` treats an existing local keypair in `work_path`
  as already existing and aborts without checking S3
- `mars ssh ca create [name]` uploads both files to the environment S3 bucket
- `mars ssh ca create [name]` prints `ssh ca "{name}" already exists` when the
  SSH CA is already present
- `mars ssh ca pull [name]` defaults to `default`
- `mars ssh ca pull [name]` downloads both SSH CA files into
  `<work_path>/ssh/ca/`
- `mars ssh ca pull [name]` prints
  `ssh ca "{name}" corrupted. the following files missing in s3` when one or
  more expected objects are missing
- `mars ssh ca pull [name]` lists the missing S3 files when corruption is
  detected
- `mars ssh ca clear <name>` clears the local cached files when present
- `mars ssh ca clear <name>` exits successfully when the local files do not exist
- `mars ssh ca destroy <name>` requires interactive confirmation
- `mars ssh ca destroy <name>` requires the exact SSH CA name as confirmation
- `mars ssh ca destroy <name>` deletes the S3 objects and local cached files
- `mars ssh ca destroy <name>` prints `ssh ca "{name}" not found` when the SSH
  CA cannot be found
- future SSH certificate issuance can rely on the documented
  `MARS_SSH_CA_<name>_PASS` environment variable pattern without requiring
  changes to this stored-key layout
