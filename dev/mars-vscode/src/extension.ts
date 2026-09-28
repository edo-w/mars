import path from 'node:path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

function notifyFileChange(uri: vscode.Uri, type: number, output: vscode.LogOutputChannel): void {
  const activeClient = client;
  if (!activeClient) {
    return;
  }

  const change = { uri: uri.toString(), type };
  const parameters = { changes: [change] };
  void activeClient.sendNotification('workspace/didChangeWatchedFiles', parameters).catch(error => {
    output.error(`Could not notify the Mars language server about ${uri.toString()}: ${String(error)}`);
  });
}

function serverOptions(context: vscode.ExtensionContext): ServerOptions {
  const configuredPath = process.env.MARS_LSP_PATH;
  if (configuredPath) {
    if (configuredPath.endsWith('.dll')) {
      return { command: 'dotnet', args: [configuredPath] };
    }

    return { command: configuredPath };
  }

  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error(`Mars language server is not packaged for ${process.platform}/${process.arch}.`);
  }

  const executable = context.asAbsolutePath(
    path.join('server', 'win32-x64', 'Mars.Lsp.exe'),
  );

  return { command: executable };
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('Mars Workflows', { log: true });
  context.subscriptions.push(output);

  try {
    const server = serverOptions(context);
    const watchers = [
      vscode.workspace.createFileSystemWatcher('**/*.mwf'),
      vscode.workspace.createFileSystemWatcher('**/mars.yml'),
      vscode.workspace.createFileSystemWatcher('**/mars-workflow.yml'),
    ];
    context.subscriptions.push(...watchers);
    for (const watcher of watchers) {
      context.subscriptions.push(watcher.onDidCreate(uri => {
        notifyFileChange(uri, 1, output);
      }));
      context.subscriptions.push(watcher.onDidChange(uri => {
        notifyFileChange(uri, 2, output);
      }));
      context.subscriptions.push(watcher.onDidDelete(uri => {
        notifyFileChange(uri, 3, output);
      }));
    }

    const options: LanguageClientOptions = {
      documentSelector: [{ scheme: 'file', language: 'mars-workflow' }],
      initializationOptions: { trusted: vscode.workspace.isTrusted },
      outputChannel: output,
    };

    client = new LanguageClient('mars-workflow', 'Mars Workflows', server, options);
    context.subscriptions.push(
      vscode.workspace.onDidGrantWorkspaceTrust(() => {
        const activeClient = client;
        if (activeClient) {
          void activeClient.sendNotification('mars/workspaceTrustChanged', { trusted: true }).catch(error => {
            output.error(`Could not update Mars workspace trust: ${String(error)}`);
          });
        }
      }),
    );

    await client.start();
  } catch (error) {
    client = undefined;
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`Mars language server could not start: ${message}`);
    void vscode.window.showErrorMessage(`Mars language server could not start: ${message}`);
  }
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
    client = undefined;
  }
}
