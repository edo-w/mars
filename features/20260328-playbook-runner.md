# Mars Playbook Runner

## Summary

Add a lightweight Ansible-like playbook runner to Mars.

This feature introduces the playbook execution model, the playbook and task
contracts, the SSH transport layer, and the runtime needed to execute
idempotent tasks across one or more nodes.

This feature defines the runner and the core contracts. It also includes one
simple built-in test task, `echowait`, so Mars can exercise task sequencing,
SSH connection reuse, and event/reporting behavior end to end.

## Goals

- Run ordered task lists across one or more nodes.
- Run each task across eligible nodes in parallel.
- Skip failed nodes for later tasks.
- Keep task execution idempotent and safe to re-run.
- Reuse Mars node inventory and SSH CA systems.
- Avoid shelling out to `ssh`; use an SSH library directly.
- Support TypeScript-defined playbooks.
- Surface structured per-task and per-node results during execution.

## Non-Goals

- Full Ansible replacement.
- Full module parity with Ansible.
- Persistent playbook history in this feature.
- Deployment orchestration in this feature.
- Drift reconciliation or continuous config enforcement.
- Rollback support.
- Defining a full library of task modules in this feature.

## Core Concepts

### Nodes

Target machines the playbook runs against over SSH.

Nodes come from the Mars node inventory.

### Tasks

Idempotent units of desired-state work.

A task must:

- inspect current state
- apply only when needed
- report whether it changed anything
- be safe to re-run

### Results

Structured task execution output used for operator reporting and future
metadata persistence.

### Task Status

If a task fails on a node:

- that node becomes failed for the playbook run
- later tasks are skipped for that node
- other nodes continue

### Playbook

A collection of tasks executed as one unit.

## Execution Model

- Tasks run in the declared order.
- For a given task, all non-failed nodes run in parallel.
- If a node fails a task, later tasks are skipped for that node.
- Execution is forward-only.
- Recovery is re-running the full playbook.

### Flow

```text
for each task:
  run task on all non-failed nodes in parallel
  collect results
  mark failed nodes
  continue to next task
```

### Example

```text
Task 1:
  node1 changed
  node2 failed
  node3 ok

Task 2:
  node1 runs
  node2 skipped
  node3 runs
```

## Failure Model

- failure is per-node
- other nodes continue
- no rollback
- full playbook re-run is the recovery model

The playbook runner should still complete the task list for all non-failed
nodes and then return an aggregate run result.

## Idempotency Rules

Tasks must follow:

```text
check -> apply if needed -> report
```

Rules:

- ensure desired state instead of blindly executing commands
- safe to run multiple times
- no reliance on previous successful playbook runs
- no reliance on mutable hidden state outside the node

## Playbook Definition Model

Playbooks are TypeScript files.

We need a small API surface the file can import to define:

- playbook metadata
- target node selection
- ordered tasks
- task options and task-local configuration

Suggested developer experience:

```ts
import { definePlaybook, selectNodes } from '#src/app/playbook/playbook-api';

export default definePlaybook({
  name: 'bootstrap-swarm',
  targets: selectNodes({
    tags: ['swarm'],
  }),
  tasks: [
    // future task definitions
  ],
});
```

The exact task-definition helpers can stay small in this feature. The main goal
is to establish the contract shape the runner consumes.

Playbooks should be loaded dynamically at runtime through Bun:

- `const playbookModule = await import(filePath)`

## Task Definition Model

Tasks are defined as data, not as inline executable closures inside the
playbook file.

The user defines a task by calling a helper like:

```ts
createTask(type, name, input)
```

That helper returns a plain task object the playbook runner can execute later.

This keeps the playbook file declarative and lets the runner resolve the actual
task handler implementation at runtime.

### Built-In V1 Test Task

V1 includes one simple built-in task:

- `echowait`

`echowait` takes a list of steps like:

```ts
[
  ['do work', 10],
  ['pretend step2', 5],
]
```

For each step it:

- runs `echo <message>` remotely
- runs `sleep <seconds>` remotely
- proceeds to the next step

This task is intentionally simple and exists mainly to validate:

- task wave sequencing
- SSH connection handling
- reconnect behavior
- progress events
- multi-task playbook flow

## Node Targeting

Playbooks should target nodes through Mars inventory data, not raw ad hoc host
lists.

V1 targeting inputs:

- tag filters only

The runner resolves those selectors into node records before execution.

Tag selector rules:

- match any node where any selected tag matches
- if any requested tag matches a node tag, include that node
- this matches the current node inventory tag-filter behavior

Only nodes with usable connection data should be runnable.

## SSH Transport

The runner should connect to nodes through an SSH client library, not by
shelling out to the `ssh` binary.

V1 library:

- `ssh2`

Requirements:

- open SSH sessions directly from Node/Bun
- execute remote commands
- transfer small payloads when needed
- capture stdout, stderr, and exit status
- support timeouts and disconnect handling

## SSH Authentication Model

Playbook execution should integrate with the existing SSH CA system.

Expected flow:

1. resolve target node
2. resolve the node SSH connection settings
3. load the environment SSH CA
4. decrypt the managed SSH CA password in memory
5. issue a short-lived SSH certificate on demand
6. use that identity to connect to the node

Requirements:

- private key and password stay in memory only
- no decrypted password persistence
- no shelling out to `ssh`
- issue one short-lived cert per playbook run and reuse it for all node
  connections in that run
- when `ssh-keygen` needs the CA passphrase, Mars should bridge it through
  key-agent memory instead of writing the password to disk
- the askpass bridge should:
  - store a one-time askpass token in key-agent memory
  - keep a 30 second TTL so local out-of-band end-to-end testing remains
    possible
  - clear the token automatically on first successful read
  - resolve the password through `mars ssh askpass get <token>`
- Mars should also expose manual testing helpers:
  - `mars ssh askpass set <password> [--ttl <seconds>]`
  - `mars ssh askpass clear <token>`
- if an askpass launcher file is needed, it may only contain the command bridge
  and never the password itself
- askpass launch must work in both Bun script mode and the compiled Mars binary

For V1 we can assume:

- all nodes are configured to trust the default SSH CA
- Mars uses the default SSH CA unless configured otherwise later

## Connection Data

The runner needs a normalized connection model derived from the node record.

Suggested V1 connection shape:

- `host`
  - usually `public_ip` for now
- `port`
  - default `22`
- `user`
  - default `mars`
- `ca`
  - SSH CA name, default `default`

Since node inventory no longer has a dedicated `connection` object, these
values should come from:

- `public_ip`
- node properties such as:
  - `ssh.user`
  - `ssh.port`
  - `ssh.ca`

Default resolution rules:

- `host = public_ip`
- `port = Number(node.properties['ssh.port'] ?? 22)`
- `user = String(node.properties['ssh.user'] ?? 'mars')`
- `ca = String(node.properties['ssh.ca'] ?? 'default')`

## Task Runtime Contract

Even though concrete task modules are out of scope, this feature should define
the runner-facing task and handler interfaces.

Suggested task definition shape:

```ts
interface PlaybookTask {
  id: number;
  type: string;
  name: string;
  input: Record<string, unknown>;
}
```

`id` is the task index in the ordered playbook task list.

Suggested handler contract:

```ts
interface PlaybookTaskHandler {
  run(context: TaskContext, input: Record<string, unknown>): Promise<TaskResult>;
}
```

Task handlers are resolved through a factory.

Suggested model:

- playbook runner reads `task.type`
- task handler factory resolves the handler class for that type
- factory creates the handler from the container
- runner calls:
  - `taskHandler.run(context, task.input)`

```ts
taskHandler.run(context, input)
```

Suggested task result shape:

- `status`
  - `ok`
  - `change`
  - `fail`
  - `skip`
- `ok`
  - `true` when `status` is `ok` or `change`
  - `false` when `status` is `fail` or `skip`
- `message`
- `stdout`
- `stderr`
- `output`
  - optional structured result payload

Status meanings:

- `ok`
  - task ran and no changes were needed
- `change`
  - task ran and changes were made to reach desired state
- `fail`
  - task ran and failed
- `skip`
  - task was skipped because a previous task failed on that node

This lets future task modules plug in without changing the runner contract, and
keeps result status words aligned with the repo convention of using base words
instead of tense-heavy names.

## Task Handler Registry

The runner needs a registry that maps task types to handler classes.

Suggested model:

- registry stores:
  - `task type -> handler class`
- task handler factory takes a task type
- factory uses the container to create the handler instance

This lets handlers resolve whatever dependencies they need without making the
playbook file itself responsible for wiring those dependencies.

## Playbook Run Object

`PlaybookService` should not hold the entire active run state internally.

Instead:

- `PlaybookService` loads the playbook
- resolves targets
- prepares shared run resources
- creates a `PlaybookRun`
- returns that run object to the caller

`PlaybookRun` is responsible for:

- emitting live progress events
- coordinating task execution across tasks and nodes
- owning temporary run resources
- exposing:
  - `result(): Promise<PlaybookRunResult>`

This allows:

- live progress feedback
- strong final result capture
- clean centralized cleanup when the run finishes

## Progress Events

Both the playbook runner and task handlers should be able to emit progress
events.

Two event scopes:

- playbook-scoped events
  - task wave started
  - task wave finished
  - node skipped
  - playbook started
  - playbook finished
- task-scoped events
  - emitted by task handlers while they work

This gives callers live feedback without forcing them to wait for the final
result before seeing useful information.

Baseline V1 event list:

- `playbook.start`
  - `playbook_name`
  - `node_ids`
  - `task_total`
  - `start_date`
- `playbook.end`
  - `playbook_name`
  - `ok_node_ids`
  - `change_node_ids`
  - `fail_node_ids`
  - `skip_node_ids`
  - `start_date`
  - `end_date`
  - `duration`
- `task.wave.start`
  - `task_id`
  - `task_name`
  - `step`
  - `total`
  - `node_ids`
- `task.wave.end`
  - `task_id`
  - `task_name`
  - `step`
  - `total`
  - `ok_node_ids`
  - `change_node_ids`
  - `fail_node_ids`
  - `skip_node_ids`
  - `duration`
- `task.node.start`
  - `node_id`
  - `task_id`
  - `task_name`
  - `start_date`
- `task.node.end`
  - `node_id`
  - `task_id`
  - `task_name`
  - `status`
  - `duration`
  - `message`
  - `output`
- `task.node.progress`
  - optional for long-running tasks
  - `node_id`
  - `task_id`
  - `message`
  - `step`
  - `total`
  - `percent`

Event notes:

- `task.node.progress` is optional in V1
- `task.node.end` replaces the older split between result and end events
- node-id lists in wave and playbook end events can be used both for reporting
  and for deriving counts

## Playbook Run Result Model

The runner should return a structured aggregate result.

Suggested top-level result:

- playbook name
- target node ids
- task results grouped by task and node
- per-node final status
- counts:
  - ok
  - change
  - fail
  - skip
- start date
- end date
- duration

This feature can keep results in memory and print them for the operator.

## Concurrency Model

For each task:

- execute eligible nodes in parallel
- wait for all node results for that task
- then continue to the next task

The runner should use `Promise.allSettled(...)` for node fan-out so one node
failure does not abort the entire task wave.

We should keep node concurrency configurable later, but V1 can start with
"all target nodes in parallel."

## Timeouts And Cancellation

Suggested V1 support:

- per-task timeout
- connection timeout
- remote command timeout

Cancellation and resume can wait for a later feature.

## Reporting

This feature should report progress to the operator as the playbook runs.

For V1, console logging is enough. Persistence into DB tables can come later.
The baseline reporting contract is the event list defined above.

## Storage And Persistence

This feature does not persist playbook runs yet.

Future work can store:

- playbook runs
- task runs
- node run results

Likely destinations:

- node store metadata
- future deploy database

## Suggested Code Structure

- `src/app/playbook`

Suggested files:

- `playbook-models.ts`
- `playbook-shapes.ts`
- `playbook-service.ts`
- `playbook-run.ts`
- `playbook-api.ts`
- `playbook-runner.ts`
- `playbook-node-runner.ts`
- `playbook-task.ts`
- `playbook-result.ts`
- `playbook-task-handler.ts`
- `playbook-task-handler-factory.ts`
- `playbook-task-registry.ts`
- `ssh-client.ts`
- `ssh-runner.ts`

CLI surface for V1:

- `mars playbook run <file>`
  - optional `--env <env>`

## Implementation Notes

The main architecture decisions are resolved.

Implementation should follow these agreed rules:

- playbooks load through dynamic `await import(...)`
- playbooks use a default export
- V1 node targeting uses tag selectors only with any-match behavior
- tasks are declarative data created through `createTask(type, name, input)`
- task handlers own their own validated input classes
- task handlers resolve through the task handler factory and container
- `PlaybookRun` owns run state, events, and cleanup
- SSH uses `ssh2`
- one short-lived SSH cert is issued per run and reused across node connections
- one SSH connection is kept per node for the run
- connection setup and reconnect are runner responsibilities, not task
  responsibilities
- reconnect retries happen up to 3 times for connection-loss failures
- tasks remain idempotent so retrying after reconnect is safe
- if a playbook matches no nodes, the run fails fast
- V1 requires all targeted nodes to resolve to the same SSH CA name for the run

This feature is implementation-ready.
