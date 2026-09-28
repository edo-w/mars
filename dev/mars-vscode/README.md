# Mars Workflows for VS Code

Adds syntax coloring and live diagnostics for `.mwf` files. Diagnostics come from the
bundled .NET Mars language server. In untrusted workspaces, the server checks syntax
without starting module processes.

The current VSIX includes a Windows x64 language server. For local development,
set `MARS_LSP_PATH` to a built server executable or `.dll` before starting VS Code.

From the repository root, run `mise vscode:package` to build the extension and
Native AOT server, or `mise vscode:test` to install that VSIX in a workspace local
VS Code copy and check that live diagnostics appear and clear after an edit.

Run `mise vscode:dev` to open the packaged extension in a separate VS Code profile
for manual testing. The editor stays open until you close it. The automated
`vscode:test` command still exits after its smoke test.
