import path from 'node:path';
import { runVSCodeCommand } from '@vscode/test-electron';

async function main(): Promise<void> {
  const extensionRoot = process.cwd();
  const repoRoot = path.resolve(extensionRoot, '../..');
  const cachePath = path.join(repoRoot, '.cache', 'vscode-test');
  const userDataDirectory = path.join(cachePath, 'manual-user-data');
  const extensionsDirectory = path.join(cachePath, 'manual-extensions');
  const vsixPath = path.join(extensionRoot, 'dist', 'mars-vscode.vsix');
  const options = { version: 'stable', cachePath } as const;

  const installArguments = [
    '--install-extension', vsixPath,
    '--force',
    '--user-data-dir', userDataDirectory,
    '--extensions-dir', extensionsDirectory,
  ];
  await runVSCodeCommand(installArguments, options);

  const openArguments = [
    repoRoot,
    '--new-window',
    '--user-data-dir', userDataDirectory,
    '--extensions-dir', extensionsDirectory,
  ];
  await runVSCodeCommand(openArguments, options);
}

void main().catch(error => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
