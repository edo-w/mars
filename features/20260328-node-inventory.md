# Mars Node Inventory

## Summary

Add environment-scoped node inventory management to Mars.

This feature stores node metadata only. It does not create, destroy, or mutate
the actual infrastructure resource. Nodes continue to be created outside Mars,
typically by Terraform or Terragrunt. Mars keeps a local-and-backend-synced
inventory of node metadata so later deployment, bootstrap, and orchestration
features can target the right nodes.

This inventory is similar in spirit to Ansible inventory, but stored as
structured Mars state inside a database and synced through the existing backend
workflow.

## Goals

- Track environment-scoped node metadata in Mars.
- Support manual create, show, list, and remove operations.
- Support mutable node status.
- Support mutable node properties through simple property commands.
- Support tags so dynamic nodes can be targeted later without relying on cloud
  instance ids.
- Keep staged local edits until the operator explicitly saves the node store.
- Reuse the same local-state plus save workflow as the KV store.
- Record write-side node events for later audit and troubleshooting.

## Non-Goals

- Creating or deleting cloud nodes in this feature.
- Collecting nodes from Terraform or Terragrunt output in this feature.
- Running bootstrap, deployment, or orchestration actions in this feature.
- Reconciling Mars inventory automatically with live cloud state.
- Node history snapshots or versioning in this feature.
- Support for internal-only nodes in this feature.

## Design Direction

Nodes in Mars are inventory records, not durable infrastructure identities.

For V1 we will assume all nodes have a public IPv4 address, and that public IP
is the stable operator-facing handle we use to derive the Mars node id.

Example:

```text
1.1.1.1 -> ip-1-1-1-1
10.0.1.12 -> ip-10-0-1-12
```

This keeps the UX simple and readable while still letting us preserve a stable
per-environment node key inside Mars.

## Minimal Useful Node Shape

For V1, the node record shape is intentionally small:

- `id`
- `hostname`
- `public_ip`
- `private_ip`
- `status`
- `properties`
- `create_date`
- `update_date`

Recommended structure:

```json
{
  "id": "ip-1-2-3-4",
  "hostname": "api-1",
  "public_ip": "1.2.3.4",
  "private_ip": "10.0.0.5",
  "status": "new",
  "properties": {
    "docker.installed": true,
    "os.name": "ubuntu",
    "os.version": "24.04",
    "ssh.ca": "default",
    "ssh.port": 22
  },
  "create_date": "2026-03-28T12:00:00.000Z",
  "update_date": "2026-03-28T12:00:00.000Z"
}
```

## Field Rules

### `id`

- stored as `TEXT`
- immutable after create
- may be passed explicitly as `ip-x-x-x-x`
- may be derived from a public IPv4 input

Rules:

- if the user passes `1.1.1.1`, Mars converts it to `ip-1-1-1-1`
- if the user passes `ip-1-1-1-1`, Mars keeps it as-is
- for V1, ids must follow the Mars node id format

### `public_ip`

- required for V1
- stored as `TEXT`
- unique per environment
- immutable after create

This is the practical identity anchor for V1. We can later generalize to
internal-only nodes in a future feature.

### `hostname`

- nullable
- top-level known field
- mutable through property commands

### `private_ip`

- nullable
- top-level known field
- mutable through property commands

### `status`

Closed enum for V1:

- `new`
- `bootstrap`
- `ready`
- `fail`

Meaning:

- `new`
  - node was just created or collected and has not been prepared yet
- `bootstrap`
  - node is actively being prepared
- `ready`
  - node is ready for operational use
- `fail`
  - node is unreachable, dead, or otherwise failed

### `properties`

`properties` is a general JSON object for mutable metadata.

Rules:

- defaults to `{}`
- stored as JSON text
- keys are flat strings
- keys may use:
  - `property`
  - `category.property`
- values may only be:
  - `string`
  - `number`
  - `boolean`

Examples:

- `os.name = "ubuntu"`
- `os.version = "24.04"`
- `docker.installed = true`
- `swarm.role = "manager"`
- `ssh.ca = "default"`
- `ssh.port = 22`

We intentionally keep this flat and simple so future projection into env vars,
templates, deployment metadata, and automation is easy.

## Tags

Tags exist because nodes are often dynamic and operators need flexible grouping
for targeting, selection, and later orchestration.

Commands should support:

- add tag
- remove tag
- list nodes by tag
- show tags with the node

Tag rules:

- store tags normalized
- normalize to lowercase on write
- reject invalid characters
- unique per `(node_id, tag)`

Suggested tag format:

- letters
- numbers
- `-`
- `_`

No spaces.

## Events

Add a write-side node event log table.

We log mutating actions against a node so later we can inspect how the local
node inventory changed over time.

We do not log reads.

Each event tracks:

- `id`
  - node id
- `action`
- `date`
- `context`
  - JSON text

Examples:

```json
{ "id": "ip-1-1-1-1", "action": "create", "date": "...", "context": { "id": "ip-1-1-1-1" } }
{ "id": "ip-1-1-1-1", "action": "set-property", "date": "...", "context": { "items": { "os.name": "ubuntu", "os.version": "24.04" } } }
{ "id": "ip-1-1-1-1", "action": "add-tag", "date": "...", "context": { "tags": ["master"] } }
```

Suggested V1 actions:

- `create`
- `remove`
- `set-status`
- `set-property`
- `remove-property`
- `add-tag`
- `remove-tag`

## Commands

Add a new command group:

```text
mars node
```

Subcommands:

- `mars node create <public_ip_or_id>`
- `mars node show <id>`
- `mars node list`
- `mars node remove <id>`
- `mars node rm <id>`
- `mars node set-status <id> <status>`
- `mars node event list`
- `mars node event list <id>`
- `mars node property set <id> <property> <value>`
- `mars node property get <id> <property>`
- `mars node property rm <id> <property>`
- `mars node tag add <id> <tag>`
- `mars node tag remove <id> <tag>`
- `mars node state pull`
- `mars node state save`
- `mars node state clear`

## Command Semantics

### `mars node create <public_ip_or_id>`

Create a new node record.

Input:

- required `<public_ip_or_id>`

Rules:

- if input is IPv4, convert to Mars node id format
- if input is already `ip-x-x-x-x`, keep it
- `public_ip` is required for V1
- `hostname = null`
- `private_ip = null`
- `status = "new"`
- `properties = {}`
- set `create_date` and `update_date`
- write only to local node store state
- do not save to backend automatically

Duplicate rules:

- if another node already exists with the same `id`, fail
- if another node already exists with the same `public_ip`, fail

### `mars node show <id>`

Show the node record by Mars node id.

Show output should include:

- `id`
- `hostname`
- `public_ip`
- `private_ip`
- `status`
- `create_date`
- `update_date`
- `tags`
- `properties`

Display rules:

- show output as property lines, not as a raw JSON blob
- render `properties` as a separate section
- render one property per line
- sort property keys A-Z

### `mars node list`

List known nodes for the resolved environment.

Support:

- `--tag <tags>`

Tag filter rules:

- comma-separated tags
- example:
  - `mars node list --tag master,db`
- match any of the provided tags

Recommended list output fields:

- `id`
- `hostname`
- `public_ip`
- `private_ip`
- `status`
- `tags`

List output should be presented as a table, similar to `mars kv list`.

### `mars node remove <id>`

Remove the node record and its tags from local store state.

Alias:

- `mars node rm <id>`

This is inventory deletion only.

If the node does not exist, return a not-found error.

Also record a `remove` event.

### `mars node event list`

List all node mutation events for the resolved environment.

Recommended list output fields:

- `id`
- `action`
- `date`
- `context`

List output should be presented as a table.

Context display rules:

- render `context` as compact plain text, not raw JSON
- use a stable one-line `key=value` style
- sort top-level context keys A-Z
- for nested objects, flatten the nested object into compact inline text
- for arrays, render values comma-separated

Examples:

- `id=ip-1-1-1-1`
- `new=ready; prev=new`
- `items=os.name:ubuntu,os.version:24.04`
- `tags=master,db`

### `mars node event list <id>`

List only mutation events for the given node id.

Rules:

- accept either IPv4 or Mars node id input
- resolve to Mars node id before querying
- show the same table fields as `mars node event list`
- show the same compact `context` formatting rules as `mars node event list`

### `mars node set-status <id> <status>`

Update node status.

Rules:

- node must already exist
- status must be one of:
  - `new`
  - `bootstrap`
  - `ready`
  - `fail`
- update `update_date`
- record a `set-status` event

### `mars node property set <id> <property> <value>`

Set a node property.

Rules:

- node must already exist
- property key must follow the property-key rules
- values should be parsed into one of:
  - `boolean`
  - `number`
  - `string`
- update `update_date`
- record a `set-property` event

Special handling for known top-level properties:

- `hostname`
  - updates top-level `hostname`
- `private_ip`
  - updates top-level `private_ip`

These do not live inside `properties`.

`public_ip` must not be mutable in V1.

### `mars node property get <id> <property>`

Read a node property value.

Rules:

- node must already exist
- if property is `hostname` or `private_ip`, return the top-level value
- otherwise read from `properties`
- if the property does not exist, print a property-not-found error
- no event is recorded

### `mars node property rm <id> <property>`

Remove a node property.

Rules:

- node must already exist
- if property is `hostname` or `private_ip`, set the top-level field to `null`
- otherwise remove the key from `properties`
- update `update_date`
- record a `remove-property` event

`public_ip` must not be removable in V1.

### `mars node tag add <id> <tag>`

Add a tag to the node.

Record an `add-tag` event.

### `mars node tag remove <id> <tag>`

Remove a tag from the node.

Record a `remove-tag` event.

### `mars node state pull`

Pull node store DB from backend into local work state.

Rules:

- only pull if local node store state is missing
- do not overwrite existing staged local node state

### `mars node state save`

Save staged local node store state to backend.

Rules:

- same lock-and-save model as KV
- no automatic save on create, set-status, property set, property rm, tag add,
  tag remove, or remove

### `mars node state clear`

Clear only the local node store state.

Rules:

- local reset only
- do not touch backend

## Environment Resolution

All node commands are environment-scoped and should follow the same pattern as
other Mars commands:

1. `--env <env>` when provided
2. selected environment otherwise

Errors:

- `no environment selected`
- `environment "{env}" not found`

## Id And IP Parsing

For V1 we need a small helper for the create path:

- if input matches IPv4, derive:
  - `id = ip-1-2-3-4`
  - `public_ip = 1.2.3.4`
- if input matches Mars node id format:
  - `id = ip-1-2-3-4`
  - `public_ip = 1.2.3.4`
- otherwise fail

This keeps the UX short while still storing both values explicitly.

## Property Key Rules

Property keys should:

- use lowercase
- allow letters, numbers, `_`, `-`, and `.`
- reject spaces
- reject empty segments

Examples:

- `os.name`
- `docker.installed`
- `ssh.port`
- `custom_flag`

## Storage Model

Use a dedicated node store DB, separate from KV.

Like KV, the node store should:

- live under `<work_path>/env/{env}/node/`
- sync through backend only on `mars node state save`
- use the same local staged-state workflow

Suggested local files:

- `<work_path>/env/{env}/node/store.db`
- `<work_path>/env/{env}/node/store.db-wal`
- `<work_path>/env/{env}/node/store.db-shm`

Suggested backend DB path:

- `mars/env/{env}/node/store.db`

## Database Schema

### `node_inventory`

Store core fields as columns and `properties` as JSON text.

Suggested columns:

- `id TEXT PRIMARY KEY`
- `hostname TEXT NULL`
- `public_ip TEXT NOT NULL UNIQUE`
- `private_ip TEXT NULL`
- `status TEXT NOT NULL`
- `properties_json TEXT NOT NULL`
- `create_date TEXT NOT NULL`
- `update_date TEXT NOT NULL`

### `node_tag`

- `node_id TEXT NOT NULL`
- `tag TEXT NOT NULL`
- `PRIMARY KEY (node_id, tag)`

Recommended:

- foreign key from `node_tag.node_id` to `node_inventory.id`
- index on `tag`

### `node_event`

- `node_id TEXT NOT NULL`
- `action TEXT NOT NULL`
- `date TEXT NOT NULL`
- `context_json TEXT NOT NULL`

Recommended:

- index on `(node_id, date)`

## Why Properties JSON Here

This is a good fit for a hybrid schema:

- columns for the stable identity and status fields
- JSON text for flexible future metadata

Reason:

- node metadata will grow over time
- we do not want to keep redesigning the schema for every property
- a flat property map is easy to patch, inspect, and project later

## Store Workflow

The node store should behave like KV:

- auto-pull when local state is missing
- preserve staged local state when it already exists
- only save on explicit `mars node state save`

Suggested save flow:

1. acquire lock
2. checkpoint local DB
3. upload `store.db`
4. release lock

For V1 there are no blob sidecars required.

## Locking

Reuse the generic `LockService`.

Suggested lock name:

- `node`

Path:

- `env/{env}/lock/node.json`

Same V1 lock strategy as KV:

- read-check-write
- read-back token verification
- ISO `expire_at`
- 3 minute TTL

## Code Structure

Suggested new app area:

- `src/app/node`

Suggested files:

- `node-models.ts`
- `node-shapes.ts`
- `node-repo.ts`
- `node-service.ts`
- `node-sync-service.ts`
- `migrations/`

Suggested command files:

- `node-command.ts`
- `node-create-command.ts`
- `node-show-command.ts`
- `node-list-command.ts`
- `node-remove-command.ts`
- `node-set-status-command.ts`
- `node-property-command.ts`
- `node-property-set-command.ts`
- `node-property-get-command.ts`
- `node-property-remove-command.ts`
- `node-event-command.ts`
- `node-event-list-command.ts`
- `node-tag-command.ts`
- `node-tag-add-command.ts`
- `node-tag-remove-command.ts`
- `node-state-command.ts`
- `node-state-pull-command.ts`
- `node-state-save-command.ts`
- `node-state-clear-command.ts`

## Acceptance Criteria

- Mars can create, show, list, and remove node inventory records
- Mars can update node status
- Mars can list node mutation events
- Mars can set, get, and remove node properties
- Mars can add and remove tags for nodes
- `mars node list --tag master,db` matches nodes with any of the provided tags
- `mars node show <id>` shows the node as property lines plus tags
- `mars node event list <id>` filters events by node id
- node records are stored in an environment-scoped node store DB
- local node store edits stay local until `mars node state save`
- `mars node state pull` only pulls when local state is missing
- `mars node state clear` clears only local node store state
- node ids are string ids in the `ip-x-x-x-x` format
- create accepts either IPv4 or Mars node id input
- create requires a public IP in V1
- create rejects duplicates by `id` and `public_ip`
- `status` is stored and mutable
- `properties` supports flat keys with bool, string, or number values
- `hostname` and `private_ip` can be updated through property commands
- `public_ip` is immutable in V1
- mutating node actions create `node_event` rows
- the design remains compatible with future Terraform or Terragrunt collectors

