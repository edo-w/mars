# Mars .NET 10 rewrite plan

Status: local V1 implemented. Remote API, KMS, plugins, and workflows remain deferred.

## Goal and scope

Mars is a developer automation CLI with built-in environment, KV, secrets, SSH CA,
node inventory, and lock capabilities. Workflows will compose these capabilities later.
The first implementation runs locally. A future remote API and plugins should expose
the same user-facing operations without changing the CLI command model. Each mutation
commits immediately to the active backend; there is no pull/save staging workflow.

Treat `src/`, `features/`, `infra/`, and `test/` as read-only legacy references. Put
new .NET code in `dev/`. Preserve the old toolchain during the rewrite. Do not carry
over its storage formats or command behavior automatically; document each chosen
compatibility rule before implementing it.

## Core model

| Module | Local V1 role | Durable data |
| --- | --- | --- |
| Environments | Lifecycle, properties, selection | Environment records |
| KV | Keys, versions, values, secret flag | Keys and versions |
| Secrets | Password-based key access, encryption | Wrapped keys, KDF data |
| SSH CA | CA lifecycle, short-lived certificates | CA keys, passphrase |
| Nodes | CRUD, properties, tags, events | Inventory, events |
| Locks | Environment-scoped leases | Owner, expiry |
| Workflows | Deferred | None in V1 |

Node properties, tags, and events belong to the node module. They are not separate
top-level plugins. Secrets is the crypto/key-management capability; KV stores
secret values through it, and SSH CA uses it for the CA passphrase. There is no
second, independent secrets collection in V1.

## Boundaries and dependency direction

- `Mars.Core`: domain shapes, use cases, and narrow public service interfaces such
  as `IEnvironmentService`, `IKvService`, `ISecretsService`, `ISshCaService`,
  `INodeService`, and `ILockService`. It also owns config loading and the `IVfs`,
  `IVTimer`, and `IVProcess` boundaries. No CLI parser, SQLite, or HTTP types.
- `Mars.Local`: local implementations of virtual filesystem, timer, and process
  operations, SQLite schema and migrations, local SSH tooling, and local lock
  handling. Services call
  feature repos using typed database models and Dapper AOT; services do not
  open database connections.
- `Mars.Cli`: command definitions, typed inputs, handlers, output, and dependency
  registration. Handlers call services and `IVfs` for file input or output, not SQL.
- Later: a remote client implementing the same service interfaces, plus a remote
  server that hosts the use cases. A remote backend is a transport/runtime choice,
  not a second set of business rules in CLI commands.

Use interfaces at module and infrastructure boundaries, not for every class.
Built-in modules can register through the composition root; define an external
plugin loader/SDK only when the first remote or third-party module requires it.
Keep one command vocabulary for local and remote modes.

## App identity, configuration, and environments

- Discover a repository-root `mars.yml` from the current directory upward.
  `mars init [name]` creates it with `mars_id`, `name`, and `namespace`, generating
  `mars_id` as a UUIDv7. The ID is stable app identity for local state and later
  remote use; `name` is a display name and defaults to `app`. Without
  `--namespace`, Mars derives the default namespace from the app name, such as
  `My Application` to `my-application`.
  Parse and validate `mars_id` as UUIDv7 before using it in a path. Keep backend and
  secrets-provider selection as optional later config sections, defaulting to
  `local` and `password` in V1.
- Do not add `work_path` to the new config. Durable local state has a fixed path:
  `~/.mars/app/<app_id>/state.db`. Resolve `~` with the platform user home
  directory. `MARS_HOME` overrides the `~/.mars` root; relative values resolve
  from the current directory. The `mise mars` task uses the ignored repository
  `.mars/tmp` directory for validation. Put any other app-specific local files
  under that same app directory, with explicit names and cleanup rules.
- Checkouts with the same app ID intentionally share this local state. Mars does
  not tie the ID to one checkout path or reject another checkout using it. The
  user is responsible for choosing when to reuse an ID.
- An environment is a named, app-scoped container for Mars data. It has a
  stable ID, namespace, name, and extensible properties. A new environment uses
  the app's default namespace unless one is supplied. No AWS account,
  region, Terraform path, or infrastructure resource is required to create one.
- KV, wrapped data keys, SSH CAs, nodes, and locks are scoped by environment ID.
  Work on one selected environment by default; a global `--env namespace/name`
  option overrides that selection for one command. Store the selection in
  `<checkout>/.mars/selected-environment`, beside `mars.yml`, so checkouts with
  the same app ID can safely select different environments.
- Environment properties can hold ordinary metadata such as `aws_account_id`.
  Modules and workflows may read it, and future exports can project it into
  Terraform or deployment tools. Put sensitive values in secret KV entries and
  reference them from properties rather than storing plaintext secrets there.

Example `mars.yml`:

```yaml
mars_id: 019535d5-8f9c-7b65-9f06-67c42e6d0001
name: My Application
namespace: my-application
```

## Local data and security design

- Start with one SQLite database per app at
  `~/.mars/app/<app_id>/state.db`. Include `environment_id` in
  environment-owned tables and use transactions for multi-row operations.
  Explicit migrations own schema evolution.
- Store environment metadata, KV metadata/values, wrapped data keys, CA records,
  node records/events, and leases in tables. Use SQLite BLOBs for bounded binary
  values at first. Add a blob-store contract only when actual large-file needs or
  a remote storage implementation justify it.
- Keep `mars.yml` in the repository and local operator state in the per-app
  database. The config contains no storage path override in V1.
- Writes take effect immediately in local SQLite transactions. Reads query the
  active store. A later remote client sends the same operations to an API, where
  the server commits them; do not reintroduce `state pull/save` or per-module
  SQLite snapshot files merely because the backend is remote.
- Password mode generates a random data key per environment, derives a wrapping
  key from the supplied password, and stores only the wrapped key plus KDF data.
  Encrypt secret values with authenticated encryption and per-value nonces.
  Design a provider boundary for KMS later; do not implement KMS in V1.
- Unwrap the data key on first use in a command, reuse it only during that command,
  and let process exit end its lifetime. Do not recreate the long-running key
  agent. Choose a password input path that avoids command arguments and logs.
- For SSH key creation and certificate signing, let the current Mars process
  provide the CA passphrase to `ssh-keygen` through a short-lived local askpass
  bridge. Creation needs two reads; signing needs one. Never put the passphrase
  in `ssh-keygen -N` arguments or a temporary file. If SSH tooling requires a CA
  key file, it contains the passphrase-protected key, not an unencrypted copy.
- Issue short-lived SSH client identities and clean up temporary identity files
  reliably. Keep that flow separate from the durable CA record.
- Local locks use atomic SQLite writes and leases. Include owner/token and expiry;
  later remote execution may need renewal and fencing for long-running side
  effects. Do not rely on read-then-write locking.

## Proposed workspace

```text
dev/
  mars.slnx
  Directory.Build.props
  Directory.Packages.props
  mars-core/
    src/App/<feature>/*Shapes.cs, *Service.cs
    src/App/MarsConfig/MarsConfigShapes.cs
    src/Mars.Core.csproj
    test/Mars.Core.Tests.csproj
  mars-local/
    src/App/<feature>/Local*Service.cs, Local*Repo.cs
    src/Db/StateDbSession.cs, DbMigration.cs, *Models.cs
    src/Db/Migrations/<timestamp>_<description>.cs
    src/Lib/
    src/Mars.Local.csproj
    test/Mars.Local.Tests.csproj
  mars-cli/
    src/Boot/
    src/Commands/
    src/Lib/
    src/Mars.Cli.csproj
    test/Mars.Cli.Tests.csproj
```

Target `net10.0`, nullable reference types, common build settings, central NuGet
versions, and warnings as errors. Use a normal `Program.Main`, focused boot
registration, `System.CommandLine` command/input/handler boundaries, DI, and
NUnit tests per the new local skills. Use `dotnet` directly; SDK 10.0.401 is
installed. `mise run di` restores NuGet dependencies for `dev/mars.slnx`. Keep the
existing mise tool pins unless a later step needs a .NET pin.

Namespaces follow the feature folders, such as `Mars.Core.App.Kv` and
`Mars.Local.App.LocalKv`. The config area is `MarsConfig`; domain types use
short names such as `Node` and `Environment` within their feature namespaces.
The root `.editorconfig` prefers explicit constructors and `this.` qualification
for C# code, avoiding IDE0290 and IDE0003 suggestions.

Native AOT and single-file publication are required for the CLI. Avoid runtime
reflection serialization and dynamic plugin loading in built-in modules. Use
explicit YAML nodes and source-generated JSON metadata, and validate a real
`dotnet publish` for the host platform before considering a slice complete.

## Implementation slices

1. **Workspace and CLI shell:** create the solution, projects, shared build
   settings, `mars init` with a generated UUIDv7 app ID, configuration loader,
   DI setup, root command, and smoke tests.
2. **Local persistence and environments:** per-app SQLite migration runner,
   generalized environment CRUD/properties/selection, and focused tests.
3. **Secrets:** password provider, wrapped environment keys, command-scoped
   crypto, and tests for wrong passwords, isolation, and tampering.
4. **KV:** path validation, text/binary values, secret values, versions, list/get/
   set/remove commands, and persistence tests.
5. **SSH CA:** protected CA creation, encrypted passphrase, CA inspection and
   removal, askpass bridge, short-lived certificate issuance, and cleanup tests.
6. **Node inventory:** nodes, properties, tags, statuses, events, query commands,
   and transaction tests.
7. **Locks:** named leases and CLI/service usage tests. Expose them to future
   workflows without implementing the workflow runner yet.
8. **Remote readiness review:** check that CLI handlers depend only on public
   services and that a remote client could implement those contracts. Add no
   remote runtime until its API and authentication model are specified.

For every slice: document the chosen behavior, implement the smallest complete
vertical path, run formatting/build/tests, and review the command UX. Validate
the full `dev/mars.slnx` with `mise run di`, `dotnet build`, and `dotnet test`.
The legacy Bun scripts do not validate the new .NET projects.

## Decisions to settle before or during the first slices

1. **Environment identity:** define the exact stable ID and namespace/name
   uniqueness rules. Proposed V1: unique `(namespace, name)` within an app;
   no cloud-specific fields are required.
2. **Compatibility:** should the new CLI read old `mars.config.json`, SQLite
   files, and encrypted artifacts? Proposed V1: no implicit migration; create an
   explicit importer later if existing user data needs preservation.
3. **KV storage:** inline text values up to 16 KiB in SQLite. Store file values
   and larger text values in local per-environment object files.
4. **Remote identity:** define authentication, authorization, and secret-unlock
   location before implementing the remote API. They do not block local V1.

## Local V1 implementation notes

- Environments are unique by `(namespace, name)` and use UUIDv7 IDs. The CLI
  addresses them as `namespace/name`; selection is stored per checkout in
  `.mars/selected-environment`, not in the shared app database.
- Legacy config and state are not read implicitly. Import can be a separate
  feature when needed.
- KV text values up to 16 KiB are inline SQLite BLOBs. File values and larger
  text values are stored under `~/.mars/app/:app_id/env/:env_id/kv/:id_:version`.
  Every version has a UUIDv7 primary key and a unique
  `(environment_id, key_path, version)` constraint. `kv set` accepts exactly
  one source: `--value`, `--file`, or `--input` (stdin). `--secret` selects
  encryption independently of the source. Use `--input` to avoid placing a
  secret value in the process arguments.
- KV reads accept `/key#version` as well as `--version`; `kv show` reports the
  original key creation date and latest update date from stored versions.
- Repeating `mars init` reuses and validates the existing `mars.yml` without
  changing its app ID, name, or namespace.
- Nodes retain typed string, number, and boolean properties; `hostname` and
  `private_ip` remain mutable top-level fields. Node status is limited to
  `new`, `bootstrap`, `ready`, and `fail`; public IPs are unique per environment
  when present. Tags are lowercased and may contain letters, digits, underscores,
  and hyphens. `node list --tag a,b` matches nodes with either tag.
- Node changes update `update_date`, and events retain the changed values or
  previous and new status. `node property get` reads a single property.
- SSH CA keys are passphrase protected. The key generator uses a command-scoped
  named-pipe askpass bridge, and issuance writes an identity to an explicit path.
- `sshca delete` requires the operator to type the CA name before removing its
  stored key material.
- Native AOT publishes a single distributable executable on Windows using the
  system `winsqlite3` library. Linux and macOS builds use their system SQLite
  library. The host SQLite version must support the schema and SQL used here.
- SQLite rows have matching `*Model` DTOs under `src/Db`; query projections use
  `*ViewModel` DTOs. Repos use Dapper AOT for row mapping and parameter binding.
  Table names are singular, including `schema_migration`. Date columns use
  tense-neutral names ending in `_date`, such as `create_date` and
  `expire_date`; matching .NET members use `CreateDate` and `ExpireDate`.
  A small `DbMigrator` applies timestamped migrations in order and can revert
  the latest applied migration using each migration's `Apply` and `Revert` methods.
- `dotnet test dev/mars.slnx` covers the local service paths and a real SSH CA
  issuance with `ssh-keygen`. Publish with `dotnet publish
  dev/mars-cli/src/Mars.Cli.csproj -c Release -r win-x64` on Windows.

## Concepts that were easy to omit

App identity/configuration and local operator state are distinct from
environment data. Local mutations no longer need explicit state synchronization.
Schema migration, environment scoping, secret lifecycle, logging/error output,
and lock ownership are supporting capabilities needed by all modules. The old
`env bootstrap/destroy` commands were tied to AWS resource setup; local V1 needs
environment lifecycle, while cloud bootstrap belongs with later remote plugins.
Workflows will also need run results and audit/history once that module is scoped;
node events alone are not a general workflow history.
