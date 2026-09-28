# Mars workflow editor support

Status: implemented for Windows x64. This document specifies the first editor integration for
Mars workflows. The workflow language and its semantics remain defined by
[`mars-workflow.md`](mars-workflow.md); this document does not redefine them.

## Goal

Opening a `.mwf` file in VS Code should provide useful syntax coloring and show
parser, type, import, and workflow validation errors while the user edits. The
diagnostics must come from the existing .NET `mars-workflow` compiler. The VS Code
extension must not contain another Mars parser, type checker, or module resolver.

The first release supports workflow files. The server structure should allow later
Mars features, such as config and manifest diagnostics, without changing the
workflow compiler or replacing the editor client.

`.mwf` is the Mars workflow source extension. An unqualified `call` target
resolves to a `.mwf` file. The compiler, CLI, and editor must use the same rule.

## Projects and responsibilities

```text
dev/mars-vscode/          VS Code extension: language registration, grammar, LSP client
dev/mars-lsp/             .NET 10 language server: documents, validation, LSP transport
dev/mars-workflow/        Workflow language, compiler, manifest, and module catalog
dev/mars-local/           Local workflow database and log storage
```

`mars-lsp` is a console project in `dev/mars.slnx`. It references `mars-workflow`
for compilation, manifest discovery, and module metadata. It does not execute
workflows, tasks, functions, or workflow shell steps during validation. In a
trusted workspace, module discovery may launch a manifest declared process and
send only `describe`; it must not invoke an exported task or function. Starting
that process can still run its startup code, so no module process starts in an
untrusted workspace. The same compiler result should be available to any LSP
client.

`mars-vscode` is a small TypeScript extension. Its runtime duties are to locate
and launch `mars-lsp`, connect with `vscode-languageclient`, and report server
startup errors. It contributes a declarative TextMate grammar and language
configuration. It does not perform semantic checking in TypeScript.

## File association and editing

- Register language ID `mars-workflow` for `.mwf` files.
- Provide TextMate scopes for comments (`//` and `/* ... */`), quoted strings,
  interpolation markers, numbers, booleans, operators, keywords, declarations,
  and task/function references. Coloring is lexical; the .NET compiler decides
  whether syntax is valid.
- Configure comment toggling, brackets, matching, auto closing, and indentation
  for the workflow language.
- A file containing steps but no `workflow {}` block is valid. The compiler
  supplies empty workflow properties, matching the CLI.
- Opening a file must not require `mars.yml`, an app database, or a running
  workflow. When a `mars.yml` is found above the workflow, its directory is the
  app root and `mars-workflow.yml` is loaded from that root. Without `mars.yml`,
  standalone workflows retain upward manifest discovery. The CLI and editor
  must share this rule.
- In an untrusted workspace, provide coloring and file local syntax feedback
  without launching module processes. Full import and type checking begins
  when the workspace becomes trusted.

## LSP behavior in the first release

Use a process connected over standard input and output. Standard output is
reserved for LSP frames; logs and startup errors go to standard error. Implement
the LSP lifecycle (`initialize`, `initialized`, `shutdown`, `exit`) and full text
document synchronization for `didOpen`, `didChange`, and `didClose`.

The server keeps the latest unsaved text and document version for each open URI.
It reads open documents from this overlay and other files from disk when compiling
imports and `call` targets. On open or change, it validates with the existing
compiler and publishes diagnostics for the current version. On close, it clears
diagnostics for that URI. A newer edit cancels or supersedes older validation;
stale results must never replace newer diagnostics. Unsaved `.mwf` changes take
effect immediately. For v1, `mars.yml` and `mars-workflow.yml` are read from
disk; saving either file or changing it on disk revalidates open workflows.
Unsaved YAML edits do not affect diagnostics until saved. Revalidating all open
`.mwf` documents is acceptable for the first release.

Diagnostic ranges are converted from the compiler's one based source spans to
LSP's zero based UTF-16 positions. Preserve diagnostic codes such as `WF225` in
the `code` field and use the compiler message as the diagnostic message. A
diagnostic's source URI is the file that produced it, including imported or
called workflows. Errors without a precise span use a valid file start range.
Unexpected module or file failures become diagnostics with useful context, while
the server remains alive and can validate later edits.

Each validation pass compiles the open workflow roots using their current buffer
versions, collects diagnostics by source URI, and removes duplicate reports from
shared called files. Publish one complete diagnostic list per URI only after the
pass is still current. Publish an empty list to every URI that had diagnostics in
the previous pass but has none now, including a closed document or a dependency
that is no longer called. Calculate range endpoints from source offsets and the
matching source text so multiline spans and UTF-16 positions stay correct.

The first release advertises diagnostics and document synchronization. Completion,
hover, navigation, formatting, and semantic tokens are later capabilities.

## Distribution

Development runs the .NET server from the workspace. A packaged extension must
ship a matching `mars-lsp` binary and select it by operating system and CPU
architecture. Native AOT is the target for release binaries. Start with Windows
x64; add Windows arm64, Linux, and macOS packages through platform runners before
claiming support for them. Unsupported platforms still get syntax coloring and a
clear language server startup message.

The extension does not download or execute a binary from a remote service during
activation. VSIX distribution will be considered later; there is no Marketplace
publication planned. Supported platform packages must be built and tested before
distribution.

## Acceptance criteria

1. A `.mwf` file gets Mars syntax coloring and language configuration in VS Code.
2. A valid file, including one without a `workflow {}` block, has no diagnostics.
3. Parser and type errors appear at the right range with the original `WF` code.
4. Editing an unsaved buffer updates diagnostics without saving it.
5. Fixing an error or closing the file clears stale diagnostics.
6. A `call` or module import is checked using the same compiler and manifest rules
   as `mars wf check`.
7. Validation does not create state databases, start workflow runs, or invoke
   tasks. In an untrusted workspace, it does not start module processes.
8. The server survives malformed text, missing imports, and rapid edits.
9. The server builds in Native AOT mode on the first supported platform.
10. Saving a changed manifest revalidates open workflows; unsaved YAML does not
    change validation results in v1.
11. Shared called files show one merged diagnostic list that clears when no open
    workflow still reports the error.

## References

- [VS Code language extension overview](https://code.visualstudio.com/api/language-extensions/overview)
- [VS Code language server extension guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
- [VS Code language and grammar contribution points](https://code.visualstudio.com/api/references/contribution-points)
- [Language Server Protocol specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)
