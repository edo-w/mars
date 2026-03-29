# Mars Backend And Secrets Abstraction

## Summary

Add two new abstraction layers to Mars:

- a backend abstraction for where Mars stores environment-scoped artifacts
- a secrets abstraction for how Mars gets access to an environment data key

This feature does not introduce the long-running key agent itself. Instead, it
defines the backend and secrets contracts that the key agent and future Mars
features will rely on.

The initial backend implementations are:

- `local`
- `s3`

The initial secrets providers are:

- `password`
- `kms`

## Goals

- Decouple Mars features from direct S3-only storage access.
- Decouple Mars secret handling from a single encryption mechanism.
- Let operators choose local or S3 storage for Mars-managed artifacts.
- Let operators choose password-based or KMS-based data key access.
- Keep the data key model consistent regardless of how the data key is
  obtained.
- Make future storage backends and secrets providers easy to add.

## Non-Goals

- Supporting different backends per environment.
- Supporting different secrets providers per environment.
- Automatic migration between backends.
- Automatic migration between secrets providers.
- Implementing SSH CA certificate issuance in this feature.
- Implementing the key-agent process in this feature.

## Configuration Changes

Update `mars.config.json` so it includes backend and secrets configuration.

Suggested top-level shape:

```json
{
  "namespace": "app",
  "envs_path": "infra/envs",
  "work_path": ".mars",
  "backend": {
    "local": {}
  },
  "secrets": {
    "password": {}
  }
}
```

### Backend Config

Backend config holds the backend-specific settings.

Supported backend implementations:

- `local`
- `s3`

#### `local`

Use the repository-local storage root:

- `<work_path>/local/`

Environment-scoped artifacts should then live under:

- `<work_path>/local/env/{env}/...`

#### `s3`

Use the configured bucket and the environment-scoped prefix already established
for Mars:

- `s3://{env_bucket}/mars/env/{env}/...`

### Secrets Config

Secrets config holds the provider-specific settings for data-key access.

Supported secrets providers:

- `password`
- `kms`

## Init Behavior

When `mars init` creates the initial config, it must default to:

- `backend.local: {}`
- `secrets.password: {}`

This gives operators a fully local initial mode, which they can later change to
`s3` or `kms`.

## Backend Abstraction

## Storage Model

All feature code that stores or retrieves Mars-managed artifacts must go
through the backend abstraction instead of talking directly to S3 or the local
filesystem.

Backends are responsible for operations like:

- checking whether an object exists
- reading object contents
- writing object contents
- deleting objects
- listing objects under a prefix
- returning backend-specific paths or URIs when needed for display

### Local Backend

The local backend stores data under:

- `<work_path>/local/`

Environment-scoped artifacts must use:

- `<work_path>/local/env/{env}/...`

This storage lives inside `work_path`.

It is up to the operator to decide how to handle these files locally, including
whether to commit them, ignore them, or manage them another way.

Local mode is mainly intended for quick testing without needing to set up
centralized infrastructure such as S3 and KMS.

### S3 Backend

The S3 backend stores data under the environment bucket using:

- `mars/env/{env}/...`

This is the same scoped convention already introduced for SSH CA storage.

## Secrets Abstraction

Secrets providers are responsible for returning access to the environment data
key.

Once Mars has the environment data key, encryption and decryption operations
work the same regardless of provider.

This means the provider abstraction only owns:

- how the data key is obtained
- how the data key is wrapped and unwrapped

It does not own the actual per-secret encrypt/decrypt logic after the data key
is available.

## Password Secrets Provider

The password provider derives a wrapping key from an operator-provided
password.

### Password Sources

The password provider checks environment variables in this order:

1. `MARS_SECRETS_PASSWORD_<ENV>`
2. `MARS_SECRETS_PASSWORD`

Where `<ENV>` is the resolved full environment id transformed into an
environment-variable-safe name.

Example for `gl-dev`:

- `MARS_SECRETS_PASSWORD_GL_DEV`

If the environment-specific variable is not found, Mars falls back to the
general `MARS_SECRETS_PASSWORD`.

Environment ids normalize by:

- uppercasing
- replacing `-` with `_`

### Data Key Flow

1. generate a random salt
2. derive a wrapping key from the password using `argon2id`
3. generate a random data key for the environment
4. encrypt the data key using the derived wrapping key
5. store the wrapped data key and the salt or KDF config in the backend for
   that environment
6. later, derive the wrapping key again and unwrap the stored data key

The unwrapped data key is then used for encrypt/decrypt operations for
environment secrets such as the SSH CA passphrase.

## KMS Secrets Provider

The KMS provider uses AWS KMS to wrap and unwrap the environment data key.

### Data Key Flow

1. generate a random data key for the environment
2. encrypt the data key with the configured KMS key
3. store the encrypted data key in the backend for that environment
4. when the data key is needed again, call KMS to decrypt it
5. use the decrypted data key for encrypt/decrypt operations

`mars env bootstrap` will later create the KMS resources needed for this mode.

This feature should prepare the abstraction for that behavior, but the exact KMS
resource creation is tied to the environment bootstrap workflow.

## Encryption Model

Mars secrets such as the SSH CA passphrase should be encrypted with the
environment data key, not directly with:

- the password
- KMS

This keeps the actual secret-encryption model consistent across providers.

Use a standard authenticated encryption mode such as:

- `AES-256-GCM`

Prefer built-in Bun or Web Crypto primitives where possible instead of adding
an external crypto package.

## Backend Storage Paths

For environment `{env}`, wrapped-key material is stored under:

- wrapped data key:
  - `<backend>/mars/envs/{env}/secrets/datakey.enc`
- KDF metadata or salt config:
  - `<backend>/mars/envs/{env}/secrets/kdf.json`

Here `<backend>` means:

- the local backend root when using local mode
- the configured backend object root when using S3 mode

## Scope Rules

- backend choice is global to the repository configuration
- secrets provider choice is global to the repository configuration
- users are expected to use the same backend and same secrets provider for all
  environments in the repo
- `backend` must contain exactly one configured provider
- `secrets` must contain exactly one configured provider
- if the config contains multiple configured backend keys or multiple secrets
  provider keys, Mars must reject the config as invalid
- there is no in-place migration support in this feature
- operators accept migration risk and handle it out of band for now

## Service And Code Structure

### Backend

Use:

- `src/app/backend/backend-service.ts`
- `src/app/backend/backend-factory.ts`
- `src/app/backend/backend-bootstrapper.ts`
- `src/app/backend/backend-bootstrapper-factory.ts`

This file defines the backend contract.

Implementations:

- `src/app/backend/local-backend-service.ts`
- `src/app/backend/s3-backend-service.ts`
- `src/app/backend/local-backend-bootstrapper.ts`
- `src/app/backend/s3-backend-bootstrapper.ts`

Shared backend shapes may live alongside these under the backend app folder as
needed.

### Secrets

Use:

- `src/app/secrets/secrets-service.ts`
- `src/app/secrets/secrets-provider.ts`
- `src/app/secrets/secrets-bootstrapper.ts`
- `src/app/secrets/secrets-bootstrapper-factory.ts`
- `src/app/secrets/secrets-shapes.ts`

`secrets-service.ts` defines the client-facing secrets contract used by Mars
features.

Implementations and providers:

- `src/app/secrets/key-agent-secrets-service.ts`
- `src/app/secrets/password-secrets-provider.ts`
- `src/app/secrets/kms-secrets-provider.ts`
- `src/app/secrets/password-secrets-bootstrapper.ts`
- `src/app/secrets/kms-secrets-bootstrapper.ts`

### Responsibilities

#### Backend Service

- abstract storage operations away from S3 and local filesystem details
- rely on `BackendFactory` to resolve the configured backend implementation
- operate on environment-scoped paths only

#### Backend Factory

- read `mars.config.json` through `ConfigService`
- switch on the configured backend provider
- construct and return the matching backend implementation
- keep provider-specific assembly out of feature code

#### Backend Bootstrapper

- encapsulate backend-specific environment bootstrap work
- allow `mars env bootstrap` to remain provider-agnostic
- always exist for every backend, even if some implementations are no-ops

#### Secrets Service

- expose encrypt/decrypt operations to Mars feature code
- hide the RPC details used to communicate with the key agent
- route crypto requests to the key agent using a simple client API

#### Secrets Providers

- obtain access to the environment data key
- wrap and unwrap the data key
- persist provider-specific wrapped-key material through the backend
- take the current `BackendService` as a dependency so persistence stays
  isolated from the secrets logic

#### Secrets Bootstrapper

- encapsulate secrets-provider-specific environment bootstrap work
- allow `mars env bootstrap` to run secrets setup consistently after backend
  setup
- always exist for every secrets provider, even if some implementations are
  no-ops

## Suggested Implementation Shape

- extend `mars.config.json` with backend and secrets settings
- update `mars init` defaults to `local` backend and `password` secrets
- add the backend contract and its `local` and `s3` implementations
- add backend bootstrapper contract and factory
- route existing SSH CA storage through the backend abstraction
- add the secrets contract and provider contract
- add secrets bootstrapper contract and factory
- implement password secrets provider env-var resolution
- implement KDF plus wrapped-data-key handling for the password provider
- implement KMS wrapped-data-key handling for the KMS provider
- prepare bootstrap integration points for KMS-backed mode

## Acceptance Criteria

- `mars init` writes the default backend and secrets config shape
- the default config shape written by `mars init` includes only:
  - `backend.local: {}`
  - `secrets.password: {}`
- Mars can resolve a configured backend implementation from config
- Mars can resolve a configured secrets provider from config
- Mars rejects config that declares more than one backend provider
- Mars rejects config that declares more than one secrets provider
- all environment-scoped artifact storage goes through the backend abstraction
- the local backend stores environment-scoped data under
  `<work_path>/local/env/{env}`
- the S3 backend stores environment-scoped data under `mars/env/{env}`
- the password provider checks `MARS_SECRETS_PASSWORD_<ENV>` before
  `MARS_SECRETS_PASSWORD`
- `MARS_SECRETS_PASSWORD_<ENV>` uses uppercased env ids with `-` replaced by
  `_`
- the password provider derives a wrapping key and uses it to unwrap an
  environment data key
- the password provider uses `argon2id`
- the KMS provider unwraps the environment data key through AWS KMS
- wrapped data keys are stored at `mars/envs/{env}/secrets/datakey.enc`
- KDF metadata is stored at `mars/envs/{env}/secrets/kdf.json` when needed
- secrets are encrypted with the environment data key instead of directly with
  the password or KMS
- encryption uses a standard authenticated mode such as `AES-256-GCM`
- secrets providers use the backend abstraction for their persistence needs
- backend and secrets provider choice remain repo-wide, not per-environment

