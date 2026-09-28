# Mars workflows

`Mars.Workflow` contains the parser, compiler, graph builder, value validator,
VM, module process transport, shell runner, and storage interfaces. `Mars.Local`
provides the SQLite run store and local log files. The CLI works with or without
`mars.yml`.

```text
workflow {
	input {
		name string = 'world'
	}
}

run 'echo Hello {name}'
```

Save this as `hello.mwf` and run:

```text
mars wf check hello.mwf
mars wf graph hello.mwf --format dot
mars wf run hello.mwf --input name=Mars
```

Repeat `--input key=value` or `-i key=value` to set fields. Dotted keys set
nested fields. Use `--input-json '<json>'` or `--input-file <path>` for a whole
JSON value; field options override its fields. The compiler checks all
reachable workflows before running a step.

## Modules

Place `mars-workflow.yml` beside a workflow or in a parent directory. Mars
searches upward from the workflow file and resolves the entire declared module
set before compilation.

```yaml
version: 1
modules:
  - path: company/tools
    command: bun
    args:
      - ./tools/module.ts
```

Modules exchange one JSON object per line over stdin and stdout. Standard
error carries plain or structured diagnostics. The TypeScript SDK and examples
are in [`sdk/typescript`](sdk/typescript/README.md).

Local history is stored in `workflow.db` under `MARS_HOME`. When the workflow
is inside an app, it uses `MARS_HOME/app/<mars_id>/workflow.db`; otherwise it
uses `MARS_HOME/workflow.db`. Run files are stored in the matching
`logs/wf/<run_id>/` directory.
