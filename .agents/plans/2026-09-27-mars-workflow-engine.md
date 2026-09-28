# Mars workflow engine plan

Status: initial local v1 implemented and validated.

## Contract and intended result

[The workflow specification](../files/mars-workflow.md) is the source of truth
for the language, compiler, VM, graph, and interop behavior. This plan records
project boundaries, implementation slices, validation, and remaining choices.
Update the spec when a choice below establishes new language or protocol rules.

Deliver a reusable `Mars.Workflow` .NET 10 library, a local runtime, the v1
TypeScript interop SDK, and a `mars wf` command group. The first CLI entrypoint
is `mars wf run <workflow-path>`. The completed core must also expose
validation and graph analysis without executing the workflow.

The workflow engine must run without `mars.yml` or a selected environment.
When an app exists, a later provider can expose its KV, SSH CA, environment,
node, and lock capabilities through the same module contracts. Those Mars
integrations are outside this implementation.

## Project and dependency boundaries

- Add `dev/mars-workflow/src/Mars.Workflow.csproj` and
  `dev/mars-workflow/test/Mars.Workflow.Tests.csproj` to `dev/mars.slnx`.
- `Mars.Workflow` owns syntax, typed values, module metadata, import binding,
  compilation, diagnostics, analyzed graphs, execution IR, VM, protocol
  contracts, run events, and `IWorkflowStore`. It has no dependency on
  `Mars.Core`, `Mars.Local`, `Mars.Cli`, SQLite, or `System.CommandLine`.
- `Mars.Local` references `Mars.Workflow` and supplies files, process-backed
  `mars.run`, interop process transport, and a SQLite implementation of
  `IWorkflowStore`. Process
  streaming needs a new injectable adapter: the current `IVProcess.RunAsync`
  only returns after exit and cannot carry live progress or protocol events.
- `Mars.Cli` references `Mars.Workflow` and wires `wf` commands, diagnostics,
  progress, cancellation, and host adapters. Its startup must not require an
  app for workflow-only commands.
- Put the Node-compatible TypeScript SDK in
  `dev/mars-workflow/sdk/typescript`, with its own package metadata and tests.
  Keep it separate from the read-only legacy `src/`, `features/`, `infra/`,
  and `test/` trees.

Organize the new library by area: `src/App/Language`, `src/App/Types`,
`src/App/Modules`, `src/App/Compiler`, `src/App/Graph`,
`src/App/Runtime`, and `src/App/Interop`. Use matching test areas. Place
generic utilities in `src/Lib` only when shared across these areas.

The parser and compiler return immutable, source-spanned results and
structured diagnostics. The runtime accepts only a successfully compiled
plan. This separation lets the future LSP use the language and analysis APIs
without starting a process, opening a database, or running a workflow.
Static checks prevent authored type mismatches before execution. External
commands and modules can still fail or return invalid data at runtime, so the
VM must validate their results and report a failed step with useful context.

## Implementation slices

1. **Finish the language and wire contracts.** The spec now distinguishes
   `task`, `call`, and `run`, and establishes expression basics, shape input
   compatibility, CLI inputs, shell choice, manifest discovery, and storage.
   The spec now has a precedence table and string interpolation rules. Add
   shared protocol fixtures before implementing both protocol ends.
2. **Create the project and metadata model.** Add the source/test projects,
   solution references, source spans, diagnostic codes, typed values, shape
   descriptors, canonical symbol IDs, module exports, and host interfaces.
   Keep all public types AOT-friendly and usable by a future LSP.
3. **Implement language parsing.** Build a lexer and parser for the §3 scope,
   including all four `use` forms, declarations, expressions, blocks, `let`,
   `if`/`else`, `run`, task steps, workflow calls, and returns. Keep source
   locations. Parse an optional unnamed `workflow { ... }` properties block
   and the executable file-scope body separately. Omission means an empty
   block. Reject a second workflow block.
   Recover from ordinary syntax errors enough to report several diagnostics
   without executing anything.
4. **Resolve and type-check.** Bind modules from a closed, pre-resolved set;
   detect collisions and retain canonical identities. Resolve functions,
   shapes, tasks, and workflows. Check defaults, expressions, branches,
   complete step input/output contracts, optional/list/shape values, and
   returns. Reject dynamic step targets and effects inside functions. Compile
   all reachable workflows and both sides of every condition before a run.
5. **Analyze and lower.** Derive control-flow, workflow-call, task-invocation,
   and typed data-flow graphs from the analyzed AST. Reject call cycles unless
   the spec defines recursion. Lower to source-independent execution IR with
   stable internal step identities and source links for diagnostics/events.
   Add a renderer that can produce a visual graph without executing a step.
6. **Implement the sequential VM.** Execute typed expressions and user
   functions, create frames for workflow calls, evaluate explicit env/workdir,
   await one task at a time, bind typed results, and apply fail-fast behavior.
   Model `pending`, `running`, `succeeded`, `failed`, and `cancelled` distinctly.
   Emit the §27 lifecycle events and propagate cancellation to the active
   operation. Validate task outputs at the serialization boundary.
7. **Implement the local `mars.run` task.** Lower `run` to the normal task-step
   path. Execute using the agreed shell/argument and environment rules,
   capture output and diagnostics, stream progress where available, honor the
   effective working directory, and terminate on cancellation after the
   agreed grace period. Avoid inheriting the full host environment implicitly.
8. **Implement process interop and the TypeScript SDK.** Use framed JSON lines
   over stdin/stdout, request IDs, a per-run module process, and serialized
   invocation per process. Implement `describe`, function/task invocation,
   progress, explicit terminal returns, and cancellation. Capture stderr as
   contextual diagnostics; parse structured JSON or key/value lines when
   possible and retain plain text otherwise. The SDK provides registration,
   validation, cancellation, progress, and structured logging. Module workflow
   exports provide source locations; the VM executes those workflows itself.
9. **Add local run state.** Persist run and step identities, source location,
   state transitions, timestamps, inputs, outputs, diagnostics, and terminal
   results through `IWorkflowStore`. Use UUIDv7 run IDs. Store VM events
   without tying the compiler or VM to SQLite. Put app-associated data in
   `workflow.db` beside `state.db` and per-run files in `logs/wf/<run-id>/`.
   Use a shared `MARS_HOME` location for runs with no app.
10. **Expose CLI actions.** Add `wf` with one class per command and handler.
    `wf run <workflow-path>` loads the closed module set, compiles first, prints
    all diagnostics, and starts no task on a compile error. Accept repeated
    `--input key=value` or `-i key=value`, including dotted field paths.
    Accept `--input-json` and `--input-file` for a whole JSON value. Provide
    read-only check and graph commands. Keep `--debug` behavior and AOT
    compatibility consistent with the current CLI.

## Validation gates

- Parser fixtures cover every v1 construct and malformed source with useful
  spans. Imported modules cover default, alias, wildcard, selective, and
  conflicting bindings. Cover operator precedence, parentheses, line breaks,
  semicolons, line/block comments, nested interpolation expressions, escaped
  opening braces, and short-circuit `and`/`or` behavior.
- Compiler fixtures prove wrong task inputs, unknown outputs, invalid returns,
  non-boolean conditions, dynamic targets, effects in functions, and invalid
  branches fail before the first task invocation.
- Graph fixtures cover sequential steps, both `if` branches, nested workflow
  calls, task targets, and typed result dependencies. Graph extraction performs
  no process invocation.
- VM tests use fake task/function hosts for ordered execution, nested frames,
  explicit failure, not-started steps, cancellation, and event ordering.
- Local tests run a real command, check env/workdir isolation, stream module
  progress and stderr, kill an unresponsive module after grace, and reopen
  persisted run history.
- Cross-language fixtures prove `.NET ↔ TypeScript` metadata and every v1
  value type round-trips through the protocol, including malformed payloads.
  Verify `void` contracts omit their wire `input`/`output` fields.
- CLI tests run an app-free workflow, reject an invalid workflow without side
  effects, and display diagnostics and graph data. Validate restore/build/test
  for `dev/mars.slnx`, then publish and exercise the native AOT CLI.

## Decisions captured from review

- `task 'title' { use symbol; input { ... } }` invokes a task. `call symbol`
  invokes a workflow. Either can be assigned with `let`; `run 'command'` is
  sugar for `mars.run`. The spec now shows these forms. The assignment marker
  inside input blocks is `=`, consistent with existing shape construction.
- `wf run [workflow-path]` uses `workflow.mwf` in the current directory when
  the path is omitted. `--input-json '<json>'` or `--input-file <path>` supplies
  the whole input value; repeated `--input key=value` or `-i key=value` options
  set fields, including nested fields through dotted paths.
  Validate the merged input against the file's workflow shape before a step.
  The unnamed `workflow { ... }` block defines properties; steps, calls,
  conditions, and returns are file-scope statements outside that block.
- `mars.run` tries `pwsh` and falls back to Windows PowerShell on Windows;
  it uses Bash on Linux. Exit code zero succeeds; nonzero fails the step.
- Each run receives a UUIDv7 ID. App-associated run state lives in
  `MARS_HOME/app/<app-id>/workflow.db`, beside `state.db`; logs live in
  `MARS_HOME/app/<app-id>/logs/wf/<run-id>/`. `workflow.db` is shared by all
  workflows in that app. Run records include source path, any resolved
  module export name, start/end times, inputs, outputs, step history, and
  diagnostics.

## Type compatibility example and decision

Suppose a task expects `Server { host string; port i32 }` and a workflow has
`Target { host string; port i32; zone string }`. Should `Target` be accepted?
`Target` is accepted as an input because shape inputs are structural: all
required fields and their types exist, and extra source fields are ignored.
At an interop boundary, serialize only fields declared by the target input
shape. For outputs, reject missing or unknown fields because the module
promised an exact result contract.

There is no implicit `i32` to `f32` conversion. Omitted and explicit `null`
both map to absence for `T?`; a default applies only when a field is omitted.

## Workflow manifest

The file is `mars-workflow.yml`. Search upward from the directory of the
workflow file, stopping at the first manifest. This makes the same workflow
resolve the same modules regardless of the shell's current directory.
Resolve every relative path from the manifest directory. The manifest is a
closed local module map; it does not install or download packages.

```yaml
version: 1
modules:
  - path: company/deploy
    command: node
    args:
      - ./modules/deploy/dist/index.js
  - path: company/git
    command: node
    args:
      - ./modules/git/dist/index.js
```

`path` is the canonical import path. At compilation, Mars starts each
referenced process, calls `describe`, and requires its reported identity to
match the manifest. `mars.run` is built in and needs no manifest entry. A
workflow with no external imports may run without a manifest. One module
path maps to one process command; the process stays alive for the run.
Reject duplicate paths and missing referenced modules before any step starts.

## Proposed CLI input rules

The `workflow { ... }` block is optional and defaults to an empty block; a
second block is a compile error. `--input-json` and `--input-file` accept a
complete JSON value and are mutually exclusive. Repeated field options override
that object's matching fields, regardless of option order. Parse field values against their
declared types: strings and semantic strings as text, numbers/bools/lists/
shapes as JSON. Reject a property flag for a non-object input, unknown fields,
or a malformed value before running.

## `mars.run` process rules

Use `pwsh -NoProfile -NonInteractive -Command <command>` on Windows. Fall back
to `powershell.exe -NoProfile -NonInteractive -Command <command>` when `pwsh`
is unavailable. Use `bash --noprofile --norc -c <command>` on Linux. Pass the command as one
argument; do not concatenate it into another shell command. Capture stdout
and stderr separately and preserve each stream's line order in run logs.
Use a bounded output buffer plus log files so a chatty command cannot consume
unbounded memory. Include the exit code in the failed step's error context.
On cancellation, request graceful termination, then kill the process tree
after a short bounded grace period. Define the exact grace period in the
runtime settings and test it. The minimal inherited environment must include
only what is needed to locate/start the shell, plus explicit workflow/step
values; document `PATH` and platform variables before implementation.

## Proposed standalone run storage

For runs with no `mars.yml`, use `MARS_HOME/workflow.db` and
`MARS_HOME/logs/wf/<run-id>/`. This preserves the shared database model and
does not create a fake app or `state.db`. Store the absolute source path and
manifest path on each run, so history remains attributable when several
workspaces use the same standalone database. The log directory uses the run
ID because a workflow can run many times; the workflow symbol is metadata.

The VM talks only to `IWorkflowStore` in `Mars.Workflow`. The interface
accepts typed run/step/event records and supports writing lifecycle updates
and reading run history; it exposes no SQL, file paths, or SQLite types.
`Mars.Local` implements it with `workflow.db` and local log files. A future
remote backend implements the same interface with API calls. Persisting a
transition must finish before the VM reports it as committed, so storage
failures become visible run failures instead of silently losing history.

## Interop wire protocol draft for review

Use one UTF-8 JSON object per stdout line. Every message has `v: 1`, a
string `id`, and a `type`. The host chooses an ID unique among active calls
to a process. `fn` and `task` calls both carry `name` and a schema-checked
`input` object unless the input contract is `void`; their output uses the
same `ret` envelope. `describe` also
uses `ret`. `ret.status` is exactly one of `ok`, `error`, or `cancel`.
`output` is present only for `ok` with a non-void output contract; `error`
is present only for `error`; neither is present for `cancel`. The examples
below omit full export metadata.

```json
{"v":1,"id":"d1","type":"describe"}
{"v":1,"id":"d1","type":"ret","status":"ok","output":{"module":"company/deploy"}}
{"v":1,"id":"f1","type":"fn","name":"name","input":{}}
{"v":1,"id":"f1","type":"ret","status":"ok","output":"release-1"}
{"v":1,"id":"t1","type":"task","name":"deploy","input":{"source":"./dist","labels":[]}}
{"v":1,"id":"t1","type":"progress","message":"Uploading","percent":50}
{"v":1,"id":"t1","type":"ret","status":"ok","output":{"url":"https://x","version":"1"}}
{"v":1,"id":"t2","type":"task","name":"flush_cache"}
{"v":1,"id":"t2","type":"ret","status":"ok"}
```

A failed task, function, or `describe` uses `status: "error"`, has no `output`,
and includes an error name, optional code, and message:

```json
{"v":1,"id":"t1","type":"ret","status":"error","error":{"name":"DeployError","message":"Failed"}}
```

Cancellation is a signal using the active invocation's ID. Its `ret` with
`status: "cancel"` acknowledges completed cancellation and ends the call:

```json
{"v":1,"id":"t1","type":"cancel"}
{
  "v": 1,
  "id": "t1",
  "type": "ret",
  "status": "cancel"
}
```

The last message is expanded for readability; it is one line on the wire.

The invocation might succeed or fail if it finishes before cancellation
takes effect. Progress applies to tasks and functions. The process must read
`cancel` while an invocation is active even if it runs only one invocation
at a time. Implement the `describe` schema below as shared fixtures in .NET
and TypeScript. A missing or duplicate terminal `ret`, unknown
ID, malformed line, or progress after terminal is a protocol failure with
captured stderr context.

### `describe` response schema draft

The request is `{"v":1,"id":"d1","type":"describe"}`. A successful
response uses the same terminal envelope as every other call. Its `output`
has a canonical module path and an export table:

```json
{
  "v": 1,
  "id": "d1",
  "type": "ret",
  "status": "ok",
  "output": {
    "module": "company/deploy",
    "exports": [
      {
        "kind": "shape",
        "name": "DeployInput",
        "fields": [
          { "name": "source", "type": "path" },
          { "name": "environment", "type": "string", "default": "staging" },
          { "name": "labels", "type": { "list": "string" } },
          { "name": "deadline", "type": { "optional": "datetime" } }
        ]
      },
      {
        "kind": "shape",
        "name": "DeployResult",
        "fields": [
          { "name": "url", "type": "url" },
          { "name": "version", "type": "string" }
        ]
      },
      {
        "kind": "fn",
        "name": "normalize_path",
        "input": {
          "shape": [
            { "name": "path", "type": "path" }
          ]
        },
        "output": "path"
      },
      {
        "kind": "task",
        "name": "deploy",
        "input": { "ref": "company/deploy/DeployInput" },
        "output": { "ref": "company/deploy/DeployResult" }
      },
      {
        "kind": "task",
        "name": "flush_cache",
        "input": "void",
        "output": "void"
      },
      {
        "kind": "workflow",
        "name": "release",
        "source": "./workflows/release.mars"
      },
      {
        "kind": "const",
        "name": "default_environment",
        "type": "string",
        "value": "staging"
      },
      {
        "kind": "value",
        "name": "current_region",
        "type": "string",
        "value": "us-east-1"
      }
    ]
  }
}
```

This draft uses `exports` as a discriminated array by `kind`. Export names
are unique within the module. `shape` exports define ordered fields; a field
without `default` is required unless its type is `optional`. `fn` and `task`
exports declare an input shape and any valid output type. All `fn` calls use
an `input` object keyed by parameter name, matching task calls. Workflow
exports provide a source path, resolved relative to the manifest directory;
Mars loads that file and derives its input/output contract by compilation.

Type descriptors are either a primitive name (`string`, `bool`, `i32`,
`f32`, `datetime`, `duration`, `path`, `url`), `{ "list": T }`,
`{ "optional": T }`, `{ "ref": "module/Shape" }`, or an inline
`{ "shape": [field, ...] }`. A `ref` must resolve to a described shape in
the closed module set. Recursive shapes are out of v1 unless we explicitly
add cycle handling. `void` is a separate callable-only descriptor; it cannot
appear as a field, value, list element, or optional type. `const` and `value`
carry schema-validated JSON values
in `describe`; `value` is a snapshot for this module process and run. Values
that must change during one run should be exported as functions.

The host rejects duplicate exports or fields, unknown kinds or types,
unresolved refs, invalid defaults/constants, and a module identity that
does not match the manifest. The SDK should construct this metadata from
typed registrations; module authors should not have to write the JSON.

Value encoding decision: JSON strings for `string`, `path`, and `url`;
RFC 3339 UTC strings for `datetime`; integer milliseconds for `duration`;
finite JSON numbers rounded and checked as IEEE 754 single precision for
`f32`; JSON arrays for `T[]`; JSON objects for shapes; JSON `null` or omitted
fields for `T?`. `i32` must be an in-range integer. Paths remain textual
values and are not silently resolved at the wire boundary. The shape schema
in `describe` carries the semantic type, so JSON encoding does not erase it.

## Graph output

Expose a stable JSON graph model from `Mars.Workflow`: nodes for task steps,
workflow calls, and `if` junctions; edges for control flow and typed data
dependencies; source spans and canonical targets on each relevant node.
Nested workflow calls have a reference to their compiled subgraph. Use
deterministic node IDs derived from the compiled source location and node
kind, separate from runtime step UUIDs.

Add `mars wf graph <workflow-path> --format json|dot`. JSON is the reusable
format for a future UI/LSP; DOT gives a readable visual through Graphviz and
is easy to inspect as text. Default to DOT for terminal use. Graph generation
compiles and analyzes only; it must not start a task or run storage. Avoid a
dependency on Graphviz for generating either format.

## Implementation checkpoint

- The compiler rejects interpolation of list, shape, and void values. It
  supports the agreed operators, comments, string escapes, statement endings,
  imports, and static step targets.
- Local shell and module processes inherit only the environment variables
  named in the process rules above. Cancellation has a five-second grace by
  default; the module transport permits a shorter grace in tests.
- The `describe` schema is implemented in .NET and the TypeScript SDK. Shape
  references resolve across the closed manifest set; recursive references are
  rejected. The host validates protocol IDs, terminal returns, and void wire
  fields. Shared fixtures define machine-readable protocol error codes. JSON
  and DOT graph output are implemented, with DOT as the CLI default.
- Tests cover an app-free workflow, local run persistence, TypeScript module
  calls, all v1 wire value kinds, structured diagnostics, duplicate returns,
  cancellation, graph output, and a Windows native AOT run. Module stderr from
  `describe`, functions, and tasks is persisted with run context; task stderr
  also has per-step log files.
