import child_process from 'node:child_process';

export class VProcess {
	cwd(): string {
		return process.cwd();
	}

	env(): NodeJS.ProcessEnv {
		return process.env;
	}

	exit(code: number): never {
		process.exit(code);
	}

	forceKill(pid: number): void {
		if (this.platform() === 'win32') {
			process.kill(pid);
			return;
		}

		process.kill(pid, 'SIGKILL');
	}

	getProcessInvocation(commandArgs: string[]): { args: string[]; command: string } {
		const argv = this.argv();
		const currentArg = argv[1];
		const baseArgs = this.isScriptEntryPoint(currentArg) ? [currentArg, ...commandArgs] : commandArgs;

		return {
			args: baseArgs,
			command: this.execPath(),
		};
	}

	spawnDetached(command: string, args: string[], cwd: string): void {
		const child = child_process.spawn(command, args, {
			cwd,
			detached: true,
			stdio: 'ignore',
			windowsHide: true,
		});

		child.unref();
	}

	isProcessAlive(pid: number): boolean {
		try {
			process.kill(pid, 0);

			return true;
		} catch {
			return false;
		}
	}

	argv(): string[] {
		return [...process.argv];
	}

	execPath(): string {
		return process.execPath;
	}

	getEnv(name: string): string | undefined {
		return process.env[name];
	}

	platform(): NodeJS.Platform {
		return process.platform;
	}

	private isScriptEntryPoint(currentArg: string | undefined): currentArg is string {
		if (currentArg === undefined) {
			return false;
		}

		const extension = currentArg.slice(currentArg.lastIndexOf('.')).toLowerCase();

		return (
			extension === '.ts' ||
			extension === '.mts' ||
			extension === '.cts' ||
			extension === '.js' ||
			extension === '.mjs' ||
			extension === '.cjs'
		);
	}
}
