# Mars workflow LSP and VS Code extension plan

Status: implemented. The behavior follows
[`mars-vscode-lsp.md`](../files/mars-vscode-lsp.md) using the workflow language
defined in [`mars-workflow.md`](../files/mars-workflow.md). The spec is the
contract; this plan records the implementation sequence and decisions.

## Architecture

```text
.mwf buffer in VS Code
  -> dev/mars-vscode (language registration and thin LSP client)
  -> stdio LSP
  -> dev/mars-lsp (document overlay and diagnostic publication)
  -> mars-workflow compiler, manifest, and module discovery
```

All parsing, type checking, and workflow diagnostic messages stay in .NET.
The TextMate grammar only provides immediate lexical coloring. The LSP server
does not depend on the CLI or open `state.db`/`workflow.db`.

## Implementation sequence

1. Add `dev/mars-lsp/src/Mars.Lsp.csproj` and
   `dev/mars-lsp/test/Mars.Lsp.Tests.csproj` to `dev/mars.slnx`. Keep the server
   entry point thin; put protocol startup in `src/Boot`, document handling in
   `src/App/Documents`, diagnostics in `src/App/Diagnostics`, and transport
   helpers in `src/Lib`.
2. Establish the stdio LSP transport and AOT strategy before adding features.
   Try a maintained .NET LSP library against a real Native AOT publish. If its
   reflection or dynamic serialization prevents AOT, implement the small v1
   protocol subset with explicit JSON shapes and source generated serialization.
   In either case, test framing and lifecycle with a real client process.
3. Add an in-memory document overlay keyed by URI and version. Adapt the
   compiler's `IWorkflowSourceReader` to prefer open buffers, then fall back to
   the existing file reader. Change unqualified `call` targets to resolve
   `.mwf`. Align CLI and editor manifest discovery: use `mars.yml` to find the
   app root, then load `mars-workflow.yml` there; keep upward discovery for
   standalone workflows.
4. Compile on open and change with cancellation/debouncing. Map compiler
   diagnostics to zero based UTF-16 ranges using source offsets and text.
   Preserve `WF` codes. For each current validation generation, combine and
   deduplicate diagnostics from all open roots by source URI, publish once per
   URI, and send empty lists for URIs that no longer have errors. Discard stale
   generations. Revalidate on unsaved `.mwf` edits and saved `mars.yml` or
   `mars-workflow.yml` changes; v1 does not overlay unsaved YAML buffers.
   In untrusted workspaces, run only file local lexer/parser checks. In trusted
   workspaces, use the workflow module catalog for full checks, sending only
   `describe` to module processes. Dispose processes after validation and
   avoid launching all declared modules when only one import is needed.
5. Add `dev/mars-vscode/package.json`, a small TypeScript activation module,
   `syntaxes/mwf.tmLanguage.json`, and `language-configuration.json`.
   Register `.mwf` and start the platform's packaged `mars-lsp` through
   `vscode-languageclient/node`. Keep language logic out of TypeScript.
6. Add local development and packaging tasks in `mise.toml`. Build and test
   the LSP with the solution, build the extension with Bun, and package a
   Windows x64 VSIX with a Native AOT server. Expand the platform matrix using
   matching CI runners before advertising those platforms.
7. Add focused tests: protocol lifecycle/framing, unsaved edits, stale version
   suppression, span conversion, missing imports, called workflow changes,
   shared diagnostic merging and clearing, saved manifest changes, module
   metadata, trust gating, and no execution/state creation. Add a VS Code integration
   smoke test that opens `.mwf`, observes diagnostics, edits the document, and
   observes them clear.

## Decisions to review before implementation

- **Transport library:** The AOT publish spike determines whether a .NET LSP
  package can be used directly. The narrow source generated transport is the
  fallback; semantic analysis is never duplicated.
- **Module discovery during editing:** Description is allowed only in trusted
  workspaces. The host sends `describe` only; the declared process still runs
  startup code. An untrusted workspace gets file local syntax feedback.
- **Distribution:** Windows x64 is the first packaged target. VSIX distribution
  comes later, after the desired platform packages have been built and tested.
  Marketplace publication is not planned.

## Completion gate

Build and test `dev/mars.slnx`, publish `mars-lsp` as Native AOT, run protocol
tests against the published binary, build and test `mars-vscode`, and validate
the packaged VSIX in VS Code. Review the extension bundle to confirm it has no
second parser or type checker.
