import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  downloadAndUnzipVSCode,
  runTests,
  runVSCodeCommand,
} from '@vscode/test-electron';

async function main(): Promise<void> {
  const extensionRoot = process.cwd();
  const repoRoot = path.resolve(extensionRoot, '../..');
  const cachePath = path.join(repoRoot, '.cache', 'vscode-test');
  const vscodeExecutablePath = await downloadAndUnzipVSCode({
    version: 'stable',
    cachePath,
  });
  const extensionTestsPath = path.join(extensionRoot, 'dist', 'test', 'suite.js');
  const extensionsDirectory = path.join(cachePath, 'extensions');
  const userDataDirectory = path.join(cachePath, 'user-data');
  const vsixPath = path.join(extensionRoot, 'dist', 'mars-vscode.vsix');

  const installArguments = [
    '--install-extension', vsixPath,
    '--force',
    '--user-data-dir', userDataDirectory,
    '--extensions-dir', extensionsDirectory,
  ];
  const downloadOptions = {
    version: 'stable',
    cachePath,
  } as const;
  await runVSCodeCommand(installArguments, downloadOptions);

  const installedNames = await readdir(extensionsDirectory);
  const installedName = installedNames.find(name => name.startsWith('mars-dev.mars-vscode-'));
  if (!installedName) {
    throw new Error('The packaged Mars VSIX was not installed.');
  }

  const installedExtension = path.join(extensionsDirectory, installedName);
  const smokeDirectory = path.join(cachePath, 'smoke');
  const launchArgs = [
    repoRoot,
    '--disable-workspace-trust',
    '--user-data-dir', userDataDirectory,
    '--extensions-dir', extensionsDirectory,
  ];

  const testOptions = {
    vscodeExecutablePath,
    extensionDevelopmentPath: installedExtension,
    extensionTestsPath,
    extensionTestsEnv: { MARS_SMOKE_DIR: smokeDirectory },
    launchArgs,
    reuseMachineInstall: false,
  };
  await runTests(testOptions);
}

void main().catch(error => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
