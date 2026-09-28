import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';

async function waitForDiagnostics(uri: vscode.Uri, hasErrors: boolean): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const matches = hasErrors ? diagnostics.length > 0 : diagnostics.length === 0;
    if (matches) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const allDiagnostics = vscode.languages.getDiagnostics()
    .filter(([, diagnostics]) => diagnostics.length > 0)
    .map(([diagnosticUri, diagnostics]) => ({
      uri: diagnosticUri.toString(),
      messages: diagnostics.map(item => item.message),
    }));
  throw new Error(
    `Expected diagnostics present=${hasErrors} for ${uri.toString()}. ` +
    `Current: ${JSON.stringify(allDiagnostics)}`,
  );
}

export async function run(): Promise<void> {
  assert.equal(vscode.workspace.isTrusted, true, 'The smoke workspace should be trusted.');
  const smokeRoot = process.env.MARS_SMOKE_DIR ?? path.join(os.tmpdir(), 'mars-vscode-smoke');
  const smokeDirectory = path.join(smokeRoot, randomUUID());
  const directoryUri = vscode.Uri.file(smokeDirectory);
  const configUri = vscode.Uri.file(path.join(smokeDirectory, 'mars.yml'));
  const manifestUri = vscode.Uri.file(path.join(smokeDirectory, 'mars-workflow.yml'));
  const uri = vscode.Uri.file(path.join(smokeDirectory, 'smoke.mwf'));
  await vscode.workspace.fs.createDirectory(directoryUri);
  await vscode.workspace.fs.writeFile(configUri, Buffer.from('mars_id: test\n'));
  await vscode.workspace.fs.writeFile(manifestUri, Buffer.from('version: 1\n'));
  await vscode.workspace.fs.writeFile(uri, Buffer.from('workflow {'));
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    assert.equal(document.languageId, 'mars-workflow');
    await vscode.window.showTextDocument(document);
    await waitForDiagnostics(uri, true);

    const edit = new vscode.WorkspaceEdit();
    const wholeFile = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    );
    edit.replace(uri, wholeFile, "run 'echo hello'");
    assert.equal(await vscode.workspace.applyEdit(edit), true);
    await waitForDiagnostics(uri, false);

    await vscode.workspace.fs.writeFile(manifestUri, Buffer.from('version: 2\n'));
    await waitForDiagnostics(uri, true);

    await vscode.workspace.fs.writeFile(manifestUri, Buffer.from('version: 1\n'));
    await waitForDiagnostics(uri, false);
  } finally {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    await vscode.workspace.fs.delete(directoryUri, { recursive: true });
  }
}
