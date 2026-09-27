import type { PublicLike } from '#src/lib/types';
import type { VProcess } from '#src/lib/vprocess';

type VProcessLike = PublicLike<VProcess>;

export class MockVProcess implements VProcessLike {
	currentArgv: string[];
	currentCwd: string;
	currentEnv: NodeJS.ProcessEnv;
	currentExecPath: string;
	currentPlatform: NodeJS.Platform;
	exitCode: number | null;
	killCalls: Array<[number, NodeJS.Signals | number | undefined]>;
	killFailures: Set<number>;
	spawnCalls: Array<{ args: string[]; command: string; cwd: string }>;

	constructor() {
		this.currentArgv = ['bun', 'src/cli/main.ts'];
		this.currentCwd = '/repo';
		this.currentEnv = {};
		this.currentExecPath = 'bun';
		this.currentPlatform = 'linux';
		this.exitCode = null;
		this.killCalls = [];
		this.killFailures = new Set();
		this.spawnCalls = [];
	}

	argv(): string[] {
		return [...this.currentArgv];
	}

	cwd(): string {
		return this.currentCwd;
	}

	execPath(): string {
		return this.currentExecPath;
	}

	env(): NodeJS.ProcessEnv {
		return this.currentEnv;
	}

	exit(code: number): never {
		this.exitCode = code;
		throw new Error(`process exit ${code}`);
	}

	forceKill(pid: number): void {
		if (this.currentPlatform === 'win32') {
			this.kill(pid);
			return;
		}

		this.kill(pid, 'SIGKILL');
	}

	getProcessInvocation(commandArgs: string[]): { args: string[]; command: string } {
		const currentArg = this.currentArgv[1];
		const baseArgs = isScriptEntryPoint(currentArg) ? [currentArg, ...commandArgs] : commandArgs;

		return {
			args: baseArgs,
			command: this.currentExecPath,
		};
	}

	spawnDetached(command: string, args: string[], cwd: string): void {
		this.spawnCalls.push({
			args,
			command,
			cwd,
		});
	}

	getEnv(name: string): string | undefined {
		return this.env()[name];
	}

	isProcessAlive(pid: number): boolean {
		try {
			this.kill(pid, 0);

			return true;
		} catch {
			return false;
		}
	}

	platform(): NodeJS.Platform {
		return this.currentPlatform;
	}

	private kill(pid: number, signal?: NodeJS.Signals | number): void {
		this.killCalls.push([pid, signal]);

		if (this.killFailures.has(pid)) {
			throw new Error('missing');
		}
	}
}

function isScriptEntryPoint(currentArg: string | undefined): currentArg is string {
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
