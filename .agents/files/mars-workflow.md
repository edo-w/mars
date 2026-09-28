# Mars Workflow Language and Runtime Specification

## 1. Purpose
Mars is a developer automation and workflow engine. It provides typed, reusable workflows, ordered steps, static validation, graph visualization, run state, diagnostics, and language-neutral extension modules.

Mars is not a CI system. It does not require jobs, runners, matrices, triggers, or schedules.

Mars uses a custom orchestration language. The primary rule is:

> Only a step can start a task or another workflow.

This makes every potential execution edge visible in the AST before execution.

## 2. Core model
A workflow has inputs, outputs, local values, ordered steps, conditions, environment values, and a working directory.

```text
Workflow<Input, Output>
Task<Input, Output>
```

A step invokes a task or workflow. Tasks and workflows use the same type system for inputs and outputs.

## 3. Initial language scope
V1 includes `use`, shapes, constants and values, functions, workflows, typed inputs and outputs, `let`, expressions, `if`/`else`, task steps, workflow calls, `run`, and `return`.

Expressions use the usual precedence found in most C-like languages, from
highest to lowest:

| Level | Operators | Meaning |
| --- | --- | --- |
| 1 | `()` calls, `.`, `[]` | Call, member access, indexing |
| 2 | `!`, unary `-`, unary `+` | Unary operations |
| 3 | `*`, `/`, `%` | Multiplication, division, remainder |
| 4 | `+`, `-` | Addition, subtraction |
| 5 | `<`, `<=`, `>`, `>=` | Ordering |
| 6 | `==`, `!=` | Equality |
| 7 | `and` | Boolean and |
| 8 | `or` | Boolean or |

Parentheses override precedence. Binary operators of the same level are
left-associative. `and` and `or` short-circuit. `=` is used for declarations
and named fields, not as an expression operator.

Single quotes delimit strings. Every unescaped `{` inside a string starts
an interpolation; the matching `}` ends it. The content is a normal Mars
expression, evaluated and converted to text. An interpolated expression
cannot start a task or workflow. Escape the opening brace with `\{` to
print it literally. Thus `'release-{version}'` interpolates `version`,
while `'\{}'` evaluates to the literal text `'{}'`. A closing `}` without
an unescaped opening `{` is ordinary text. `\\` represents a literal
backslash, allowing a backslash immediately before an interpolation.
`\'`, `\n`, `\r`, and `\t` represent a quote, newline, carriage return,
and tab. Unknown escapes are compile errors.

`//` starts a line comment; `/* ... */` is a block comment. A line break
ends a statement, and `;` separates statements on one line.

V1 does not include `try`/`catch`, loops, `for`, `while`, `break`, `continue`, classes, inheritance, generators, threads, workflow concurrency, dynamic task or workflow targets, reflection, `eval`, remote execution, or CI-specific concepts.

Do not add a feature only because another workflow system has it.

## 4. Effects and static graph
Mars separates computation from orchestration effects.

Computation includes literals, values, variables, expressions, functions, shapes, and collections. Control flow initially includes `if` and `else`. Effects are task steps and workflow-call steps.

Functions can call functions. Functions cannot create steps, invoke tasks, or invoke workflows.

```text
fn deploy() {
    run './deploy.sh'   // invalid
}
```

Step targets must be statically resolved. Values can be dynamic.

```text
call deploy { input { source = source } }   // valid
let target = select_workflow(environment)
call target { input { source = source } }   // invalid
```

Mars must be able to derive the potential control-flow graph, workflow-call graph, task-invocation graph, and typed data-flow graph from the analyzed AST/IR. The graph is a view of source, not the source of truth.

## 5. Functions
A function computes and returns data.

```text
fn artifact_name(app string, version string) string {
    return '{app}-{version}'
}
```

Functions do not have to be mathematically pure. They can observe external state, for example `current_branch()`, `file_exists()`, or `read_config()`. They can return different values when external state changes.

This does not create workflow graph edges because functions cannot start tasks or workflows.

Functions can be used in expressions, conditions, local-value initialization, and task/workflow input or output calculations.
Function invocations are asynchronous at the VM and interop boundary, even
when an implementation can compute its value immediately.

## 6. Shapes and types
A shape defines structured data and contains no behavior.

```text
shape Server {
    host string
    port i32
}

shape DeployResult {
    url url
    version string
    deployed_at datetime
}
```

V1 types are:

```text
string
bool
i32
f32
datetime
duration
path
url
void
```

Use `i32` and `f32` so later versions can add types such as `i64`, `u32`, and `f64` without a naming conflict.

`void` means a callable takes no input or produces no output. It is valid
only as a function or task input/output contract, not as a shape field,
variable, list element, or optional value. An input block is omitted for a
`void` input; a `void` result cannot be bound with `let` or used in an
expression.

Collections use `T[]`. Optional values use `T?`.

```text
string[]
Server[]
datetime?
```

`datetime`, `duration`, `path`, and `url` are semantic types. Interop must define canonical wire representations. Use ISO 8601/RFC 3339 for `datetime`.

The type model must permit future semantic types such as `artifact<AppBundle>`, `secret<string>`, `aws.Bucket`, or `docker.Image`.

Shape compatibility is structural for inputs. A value can supply additional
fields when it has every required target field with a compatible type; the
extra fields are ignored when passed to a task or workflow input. At an
interop output boundary, the returned shape must match the declared output
fields exactly. V1 performs no implicit numeric conversions. Omitted and
explicit `null` both represent absence for `T?`; a field default applies
only when the field is omitted.

## 7. Workflow declarations
A workflow is a source file. Its optional, unnamed `workflow` block declares
input, output, environment, working directory, and other workflow-level
settings. Omitting the block is equivalent to `workflow {}`. Executable
statements are written at file scope outside this block. A source file may
contain at most one `workflow` block; separate workflows belong in separate
files.

```text
workflow {
    input {
        source path
        environment string
    }

    output {
        url url
        version string
    }

    ...
}
```

Inline input/output blocks declare anonymous shapes. `=` uses an existing shape.

```text
workflow {
    input = DeployInput
    output = DeployResult
}
```

The compiler must type-check returned values against the declared output.

```text
return {
    url = deployment.url
    version = deployment.version
}
```

Use `let` for local values.

```text
let version = calculate_version()
```

Local-value evaluation is computation and does not create graph nodes.

## 8. Conditions
V1 supports statement-level `if` and `else`.

```text
if environment == 'production' {
    run './verify-production.sh'
} else {
    call deploy_staging { input { source = source } }
}
```

An `if` is a graph junction. Its condition must have type `bool`.

Expression-level conditional syntax is not required in v1.

## 9. Loops
Loops are not part of v1. Do not implement `for` or `while` until Mars defines failure, continue, result collection, cancellation, parallel execution, and retry semantics for iteration.

## 10. Modules and imports
A module has a canonical package/module path, for example `aws/s3`. Modules can export constants, values, shapes, functions, tasks, and workflows. Package metadata provides the export table.

`use` does not install a package. It only creates bindings for an already resolved module.

### Default module import
```text
use aws/s3
```
Binds the module to its leaf name, `s3`. Use exports as `s3.upload`, `s3.Bucket`, or `s3.exists()`.

### Alias import
```text
use aws/s3 as storage
```
Binds the module to `storage`. The original leaf name is not also bound.

### Wildcard import
```text
use aws/s3 *
```
Imports all exported symbols directly into the current module symbol table.

### Selective import
```text
use aws/s3 { upload, Bucket }
```
Imports only the named symbols directly into the current module symbol table.

The grammar is:

```text
use <module-path>
use <module-path> as <identifier>
use <module-path> *
use <module-path> { <identifier>, ... }
```

### Collision rules
A name can have only one binding in a scope. Mars has no implicit shadowing and no last-import-wins behavior.

```text
use aws/s3
use company/storage as s3   // compile error
```

```text
use aws/s3 *
use company/deploy { upload }   // error if both export upload
```

The compiler must identify both conflicting bindings. The user must remove a binding, use a module import, use an alias, or use a selective import.

Local names do not change canonical identity. If `aws/s3` is imported as `storage`, `storage.upload` still retains canonical metadata equivalent to package `aws`, module `aws/s3`, symbol `upload`.

## 11. Package resolution
All packages must be resolved before workflow compilation and execution.

```text
Package Manifest
      |
      v
Dependency Resolution
      |
      v
Resolved Package Set
      |
      v
Module Metadata
      |
      v
Workflow Compilation
      |
      v
Execution
```

Execution must not download undeclared packages, resolve arbitrary remote tasks, execute code from URLs, search a registry for missing imports, or use fallback modules.

The executable dependency set is closed before execution.

For local workflows, `mars-workflow.yml` maps canonical module paths to
process commands. Mars searches upward from the workflow file's directory
and uses the first manifest found. Relative paths in it resolve from the
manifest directory. A workflow with no external imports needs no manifest.
`mars.run` is built in and needs no manifest entry.

## 12. Tasks and steps
A task is an effectful executable with a canonical symbol, typed inputs, typed outputs, and an implementation.

```text
Task<Input, Output>
```

The compiler must know the task contract before execution. `task` invokes a
task; `call` invokes a workflow. Both are steps and can use expressions to
calculate inputs. Only steps can start execution.

```text
task 'Deploy release' {
    use deploy
    input {
        source = normalize_path(source)
        environment = environment
    }
}

let deployment = task 'Deploy release' {
    use deploy
    input {
        source = source
    }
}

task 'Flush cache' {
    use flush_cache
}
```

The title describes the step; `use` names its statically resolved task target.
`normalize_path(source)` is computation. `deploy` is the effectful step target.
The cache task illustrates a `void` input and output: it has no `input` block
and no result binding.

Each runtime step has an internal identity. Users do not need to assign IDs to every step. Mars uses the identity for state, logs, timing, progress, cancellation, graph state, and history.

A source binding such as `deployment` is separate from the runtime step identity.

## 13. Built-in `run` task
V1 requires one built-in task: `mars.run`.

```text
run 'npm build'
```

is syntax sugar for an invocation of `mars.run` with the command as input:

```text
task 'npm build' {
    use mars.run
    input {
        command = 'npm build'
    }
}
```

`run` may also have a block for step options such as `env` and `workdir`.
The local implementation tries PowerShell 7 (`pwsh`) on Windows, falling back
to Windows PowerShell when `pwsh` is unavailable. It uses Bash on Linux.
Exit code zero succeeds; a nonzero exit code fails the step.

`run` uses the normal task/step execution model. The VM does not need a special execution architecture for it.

## 14. Workflow calls
Use `call` to invoke another workflow.

```text
let deployment = call deploy {
    input {
        source = './dist'
        environment = environment
    }
}
```

`call deploy` is valid when no input is required. A call may be used without
`let` when its output is not needed. `call` never invokes a task.

A workflow call is a step. If `deploy` returns `DeployResult`, then `deployment` has type `DeployResult` and members such as `deployment.url` are statically checked.

Mars owns workflow execution. An interop module can expose a workflow symbol and source location, but it cannot execute the workflow. Mars loads, parses, resolves, type-checks, analyzes, and executes the workflow.

## 15. Failure semantics
An unhandled failed step immediately fails the current workflow. Later steps do not start.

```text
A -> succeeded
B -> failed
C -> not started
workflow -> failed
```

V1 has no `try/catch` and no language-level recovery from a failed step. Error recovery semantics can be designed later.

Writing to `stderr` does not indicate failure. Task failure is an explicit runtime/interop result.

## 16. Environment
Mars does not pass the complete host process environment to a workflow by default.

Workflow environment values are explicit:

```text
workflow {
    env {
        NODE_ENV = 'production'
        VERSION = version
    }
}
```

A step can add or override values:

```text
run './deploy.sh' {
    env {
        NODE_ENV = 'development'
        DEPLOY_VERSION = version
    }
}
```

The effective environment is a merge of workflow environment and step environment. Step values win on collision.

The runtime can provide the minimum platform environment required to start a process. Executable lookup and `PATH` behavior must be explicit runtime rules. Do not inherit the full host environment by accident.

## 17. Working directory
A workflow can define a working directory:

```text
workflow {
    workdir = './src'
}

run 'npm build'
```

A step can override it:

```text
run 'npm build' {
    workdir = './frontend'
}
```

The effective directory is `step.workdir ?? workflow.workdir`.

A step must not mutate hidden VM working-directory state for later steps. The VM supplies the effective working directory to each step explicitly.

For a workflow call, the called workflow starts from the caller's effective working directory unless the called workflow defines its own `workdir`. A relative workflow `workdir` is resolved from that inherited directory. This rule must remain deterministic.

## 18. Static type checking
Mars type-checks the complete workflow before it starts any step.

Compilation validates at least:

- Imports and module bindings.
- Symbol existence and collisions.
- Task and workflow targets.
- Static target resolution.
- Required and unknown inputs.
- Expression types.
- Task and workflow input types.
- Task and workflow output references.
- Shape construction.
- Optional values.
- `if` conditions as `bool`.
- Workflow return values.

No step starts if compilation fails.

## 19. Compiler pipeline
Use explicit compiler phases:

```text
Source
  |
  v
Lexer
  |
  v
Parser
  |
  v
AST
  |
  v
Module Resolution
  |
  v
Symbol Resolution
  |
  v
Type Resolution
  |
  v
Type Checking
  |
  v
Workflow Analysis
  |
  v
Execution IR
```

Do not combine parsing, type checking, and execution into one system.

The graph visualizer consumes the analyzed AST or execution IR. It must not reparse source to discover execution structure.

## 20. AST and workflow analysis
The AST should represent language semantics directly. Expected node kinds include module/import declarations, shape declarations, function declarations, workflow declarations, input/output declarations, local values, return statements, `if` statements, task steps, workflow-call steps, and expressions.

AST nodes should retain source locations for diagnostics.

Workflow analysis must produce enough information to identify:

- Every possible step.
- Every workflow call edge.
- Every `if` branch.
- Typed data dependencies between step outputs and later inputs.
- Canonical task/workflow identities.

## 21. Execution IR
The compiler should lower an analyzed workflow into a source-independent execution representation.

The exact representation is implementation-defined. It can initially be an executable AST rather than bytecode.

The IR must contain enough information for the VM to execute sequential statements, evaluate expressions, invoke tasks, invoke workflows, branch on conditions, bind results, and return values.

The runtime must not depend on source syntax.

## 22. Mars Workflow VM
The Mars Workflow VM executes compiled workflows.

The VM owns:

- Workflow frames.
- Inputs.
- Local values.
- Effective environment.
- Effective working directory.
- Current instruction or AST position.
- Active step.
- Workflow call stack.
- Failure propagation.
- Cancellation.

A workflow call creates a new workflow frame. When the called workflow returns, the caller resumes with the typed result.

```text
release
   |
   +-- call deploy
          |
          v
       deploy frame
          |
          +-- call verify
                 |
                 v
              verify frame
```

## 23. Execution model
V1 workflow execution is sequential. The VM starts one step at a time and waits for that step to reach a terminal state before it advances.

This does not require task implementations to use synchronous I/O.

All task invocation should be modeled internally as awaitable operations:

```text
start step
    |
    v
await operation
    |
    v
receive typed result
    |
    v
next step
```

There is no workflow-level concurrency in v1.

## 24. Async task operations
The interop model must support long-running tasks from the start.

A task operation can:

1. Start.
2. Report progress.
3. Emit diagnostics.
4. Complete successfully.
5. Fail.
6. Be cancelled.

A short task can complete immediately. A long task can remain active and send progress until completion.

Mars does not need separate language concepts for synchronous and asynchronous tasks. The VM always awaits the operation result.

## 25. Cancellation
Mars must be able to cancel the active task operation.

A user cancellation flows from the VM to the active interop operation. The module should stop the operation and return a cancelled state.

If the module does not stop within a configured grace period, Mars can terminate the module process.

Cancellation is a distinct state. It is not ordinary task failure.

## 26. Execution states
At minimum, steps support:

```text
pending
running
succeeded
failed
cancelled
```

Workflows support corresponding states.

Progress is transient operation data. It does not need to be a terminal state.

## 27. VM events
The VM should emit structured lifecycle events. Expected events include:

```text
workflow.started
workflow.completed
workflow.failed
workflow.cancelled
workflow.called
workflow.returned
step.started
step.progress
step.completed
step.failed
step.cancelled
```

These events can feed local state, a remote backend, logs, and a future live graph UI.

## 28. Interop architecture
Mars extensions use a language-neutral process boundary.

An interop module is an executable process. Mars communicates through:

```text
stdin  -> requests from Mars
stdout -> protocol responses and protocol events
stderr -> diagnostics
```

Keep the process alive for the duration of the Mars run. This permits connection pooling, SDK-client reuse, and other process-local caches.

The initial implementation can start with TypeScript because Node.js is widely available. Other SDKs can implement the same protocol later.

## 29. Interop protocol
Use a simple request/response protocol over stdin/stdout. Line-delimited JSON is sufficient for v1 if framing remains unambiguous.

Every message has a protocol version `v`, a caller-selected `id`, and a
`type`. The request types are `describe`, `fn`, and `task`. A call uses
`name` for the canonical exported symbol and `input` for its typed input,
except that `input` is omitted when the declared input type is `void`.
The response types are `progress` and `ret`. `cancel` is a control message.
Every message for one call carries its original `id`; there is no separate
operation ID. All function and task calls are asynchronous.

```text
describe
fn
task
progress
cancel
ret
```

An invocation can emit zero or more `progress` messages, followed by exactly
one terminal `ret`. Both tasks and functions follow that lifecycle, even
when they finish immediately. `ret.status` is `ok`, `error`, or `cancel`.
An `ok` return carries `output` unless the declared output type is `void`.
An `error` return carries an error with a
`name`, optional `code`, and `message`. A `cancel` return acknowledges that
cancellation completed and is the call's terminal reply. Mars waits
asynchronously for that reply.

A `cancel` message carries the active call's `id`. It requests cancellation.
The call sends one terminal `ret` under that same ID: `status: "cancel"` if
cancelled, or `ok`/`error` if it finishes before cancellation takes effect.
There is no additional acknowledgement message.

`stdout` is reserved for the protocol. An interop implementation must not write arbitrary logs to stdout.

## 30. Module metadata and `describe`
Mars asks an interop module to describe its exported symbols before compilation/execution.

Conceptual request:

```json
{"v":1,"id":"d1","type":"describe"}
```

The response is a `ret` with the same `id`, `status: "ok"`, and an `output`
object containing `module` and `exports`. The current concrete draft is in
[the workflow implementation plan](../plans/2026-09-27-mars-workflow-engine.md)
for review.

Supported export kinds can include:

```text
const
value
shape
fn
task
workflow
```

Metadata must contain enough type information for Mars to resolve imports and type-check calls without invoking the implementation.

## 31. Workflow interop
An interop module exposes a workflow by name and source location.

Conceptually:

```json
{
  "name": "deploy",
  "kind": "workflow",
  "source": "./workflows/deploy.mars"
}
```

Mars loads and executes the workflow. The module does not execute it.
The export `name` is the module binding for that source file; it is not a
name declared by the file's `workflow { ... }` properties block.

This preserves static analysis, graph visibility, type checking, VM control, failure semantics, and auditing.

## 32. Function interop
Functions can be implemented by an interop module.

Conceptual request:

```json
{
  "v": 1,
  "id": "f1",
  "type": "fn",
  "name": "normalize_path",
  "input": { "path": "./foo/../dist" }
}
```

The module sends a terminal `ret` on `f1` containing the typed value.

A function can observe external state. It cannot ask Mars to execute a task or workflow.

## 33. Task interop
Mars invokes tasks through the interop protocol.

Conceptual request:

```json
{
  "v": 1,
  "id": "t1",
  "type": "task",
  "name": "deploy",
  "input": {
    "source": "./dist",
    "environment": "production"
  }
}
```

Mars validates inputs before invocation and validates outputs before exposing them as Mars values.

A task may emit `progress` messages with `id: "t1"`, then sends exactly one
terminal `ret` with `id: "t1"`. The request ID coordinates the whole async
call. The same rule applies to functions.

## 34. Serialization boundary
Tasks and functions form a serialization boundary between Mars values and interop implementations.

```text
Mars typed value
      |
      v
validate
      |
      v
serialize
      |
      v
interop module
      |
      v
external system or computation
      |
      v
deserialize
      |
      v
validate
      |
      v
Mars typed value
```

The interop type mapping must cover all v1 Mars types, including shapes, lists, optional values, `datetime`, `duration`, `path`, and `url`.

On the wire, semantic type information comes from the described schema.
Encode `string`, `path`, and `url` as JSON strings; `datetime` as an RFC 3339
UTC string; `duration` as integer milliseconds; `f32` as a finite JSON number
that round-trips to IEEE 754 single precision; lists as arrays; and shapes as
objects. `i32` must be an in-range integer. An optional value can be `null`
or omitted. `void` has no JSON value: omit `input` or `output` for it. Paths
are not silently resolved during serialization.

## 35. Diagnostics channel
`stderr` is the diagnostic channel. It is not part of the request/response protocol and does not determine task success or failure.

Plain text is always valid:

```text
Uploading files
Connected to AWS
Deployment complete
```

Mars captures plain text into the run log and adds execution context such as time, module, workflow, and active step when available.

Structured diagnostics are encouraged from day one.

Preferred JSON example:

```json
{"level":"info","msg":"Uploading files","bucket":"site","count":42}
```

Mars can also support a simple `key=value` convention:

```text
level=info msg="Uploading files" bucket=site count=42
```

Mars should try to parse structured diagnostics. If parsing fails, Mars stores the line as plain text. A diagnostic parse failure must never fail a task.

The SDK should make structured logging easy and should write its logging output to `stderr`.

Mars, not the module, should add execution metadata that Mars already knows. Modules should not need to emit run IDs, workflow IDs, or step IDs in normal sequential execution.

## 36. Interop process lifetime and isolation
Keep required module processes alive for one Mars run.

Conceptually:

```text
start run
  |
  +-- start required module processes
  |
  +-- describe / invoke functions / invoke tasks
  |
  +-- collect stderr diagnostics
  |
  +-- finish workflow
  |
  +-- stop module processes
  v
end run
```

If a module process exits unexpectedly, Mars fails the active invocation and retains captured diagnostics.

V1 can serialize invocations to each module process. This avoids ambiguity when attributing plain stderr lines to an active invocation. Concurrent invocation of one module process can be designed later.
The process must still read and handle a `cancel` request while an invocation
is active; serialized invocation must not block cancellation control messages.

## 37. TypeScript interop SDK
The first SDK can use TypeScript/Node.js.

The SDK should hide stdin/stdout protocol details from module authors.

A module author should be able to define shapes, functions, tasks, and workflow source references through a normal TypeScript API. The SDK should then implement `describe`, function invocation, task invocation, cancellation, progress, serialization, and structured diagnostics.

Conceptual API only:

```ts
const mars = defineModule('company/deploy')

mars.shape('DeployResult', {
  url: t.url,
  version: t.string,
})

mars.fn('deploymentName', inputs, t.string, handler)
mars.task('deploy', inputs, DeployResult, handler)
mars.workflow('release', './workflows/release.mars')

mars.serve()
```

The exact TypeScript API is not part of the language specification.

## 38. Backend independence
Workflow compilation and execution are independent of Mars state storage.

The workflow engine depends on `IWorkflowStore` for run history, step
state, events, inputs, outputs, and diagnostics. The local backend implements
that interface with SQLite and local log files. A future remote backend can
implement the same interface with API calls. Storage implementations must not
change workflow language or VM semantics.

The local runtime can use a SQLite database in the user's home directory. A remote backend can store the same logical run/state data through an API backed by SQL or another implementation.

The workflow VM runs locally in the current scope. A remote backend provides persistence and providers. It does not execute workflow plans.

Hosted agents and remote execution are separate future features.

## 39. Graph visualization
Mars must be able to create a visual graph from the analyzed workflow without executing it.

The visualizer can treat these constructs as structural graph elements:

- Task steps.
- Workflow-call steps.
- `if`/`else` junctions.

Functions and ordinary expressions are not orchestration graph nodes.

A workflow-call node can be expandable so the UI can show the called workflow's internal graph.

Because symbol and type resolution are complete, Mars can also show typed data edges from one step's outputs to another step's inputs.

The visual graph is always derived from the source/AST/IR. Editing a graph is not required in v1.

The CLI can export the graph as JSON or DOT. JSON is the machine-readable
model for a future UI or LSP; DOT is a text visualization format. Exporting
either format does not execute workflow steps.

## 40. V1 runtime invariant
Before Mars starts the first step, it must know:

- The resolved package set.
- The imported modules.
- The available symbols.
- The type of every workflow input and output.
- The type contract of every reachable task.
- The target of every task step.
- The target of every workflow-call step.
- Every possible `if` branch.
- The potential workflow/task call graph.

Run-time values can determine which static branch executes. Run-time values cannot introduce new executable targets.

## 41. Representative workflow

```text
use company/deploy { deploy, DeployResult }

shape ReleaseResult {
    version string
    url url
    deployed_at datetime
}

fn calculate_version() string {
    return read_version_from_git()
}

workflow {
    input {
        environment string = 'staging'
    }

    output = ReleaseResult

    workdir = '.'

    env {
        NODE_ENV = 'production'
    }
}

let version = calculate_version()

run 'npm ci'
run 'npm run build'

if environment == 'production' {
    run 'npm test'
}

let deployment = task 'Deploy release' {
    use deploy
    input {
        source = './dist'
        environment = environment
        version = version
    }
}

return {
    version = version
    url = deployment.url
    deployed_at = deployment.deployed_at
}
```

This example demonstrates the intended v1 model: explicit imports, typed
shapes, a non-step function, workflow-level environment and working directory,
sequential steps, a static condition, a statically resolved task step, and a
typed return value.

## 42. V1 implementation order
A practical implementation order is:

1. Define the type model and module metadata model.
2. Implement the lexer and parser.
3. Build the AST with source locations.
4. Implement module/import resolution and collision checks.
5. Implement symbol and type resolution.
6. Implement expression type checking.
7. Implement workflow/task contract checking.
8. Implement workflow analysis and graph extraction.
9. Define the execution IR.
10. Implement the sequential Workflow VM.
11. Implement `mars.run`.
12. Define the process interop protocol.
13. Implement the TypeScript interop SDK.
14. Implement function and task invocation.
15. Implement progress and cancellation.
16. Implement diagnostic capture and structured-log parsing.
17. Connect VM lifecycle events to local run state.

## 43. Explicit non-goals for v1
Do not expand v1 to solve these problems:

- Loop semantics.
- Error recovery syntax.
- Retries.
- Parallel workflow execution.
- DAG scheduling.
- Remote agents.
- Hosted execution.
- Trigger/event systems.
- CI matrix behavior.
- Visual workflow authoring.
- A public package registry.
- Distributed execution.

The v1 goal is to prove the core model: a typed, statically analyzable, graphable workflow language with explicit effect steps, reusable workflows, a small VM, and a language-neutral interop boundary.

## 44. CLI entrypoint and run history

`mars wf run [workflow-path]` names a source file. When omitted, the path is
`workflow.mwf` in the current directory. CLI input can be given as repeated
`--input key=value` or `-i key=value` options. Dotted keys address nested
fields. `--input-json '<json>'` supplies a whole JSON value, and
`--input-file <path>` reads a JSON value from a file. Field options override
fields in the whole value. The compiler and runtime validate that
workflow's input before executing a step.

Each execution has a UUIDv7 run ID. App-associated history is stored in a
shared `workflow.db` beside the app's `state.db`. Run logs are kept under
`logs/wf/<run-id>/` in the app directory. History records the workflow source
and location, timing, inputs, outputs, step state, and diagnostics. The
workflow engine accesses this state through an interface so the local and
future remote backends can provide their own implementations.
