import child_process from 'node:child_process';
import path from 'node:path';
import { KeyAgentClient } from '#src/cli/app/key-agent/key-agent-client';
import {
	KEY_AGENT_SHUTDOWN_TIMEOUT_MS,
	KEY_AGENT_STARTUP_DELAYS,
	KeyAgentPingRequest,
	type KeyAgentPingResponse,
	type KeyAgentPingResult,
	type KeyAgentShowResult,
	KeyAgentShutdownRequest,
	type KeyAgentShutdownResponse,
	type KeyAgentStartResult,
	type KeyAgentStopResult,
} from '#src/cli/app/key-agent/key-agent-shapes';
import type { StateService } from '#src/cli/app/state/state-service';
import type { KeyAgentState } from '#src/cli/app/state/state-shapes';
import { forceKill, isProcessAlive } from '#src/lib/process';
import { sleep } from '#src/lib/promise';

export class KeyAgentManager {
	stateService: StateService;

	constructor(stateService: StateService) {
		this.stateService = stateService;
	}

	async ensureRunning(): Promise<KeyAgentState> {
		const runningKeyAgent = await this.getRunningKeyAgent();

		if (runningKeyAgent !== null) {
			return runningKeyAgent;
		}

		const startResult = await this.start();

		if (startResult.kind === 'timeout') {
			throw new Error('failed to start key-agent. ping timeout');
		}

		return startResult.key_agent;
	}

	async show(): Promise<KeyAgentShowResult> {
		const keyAgent = await this.getRunningKeyAgent();

		if (keyAgent === null) {
			return {
				kind: 'stopped',
			};
		}

		return {
			key_agent: keyAgent,
			kind: 'running',
		};
	}

	async ping(): Promise<KeyAgentPingResult> {
		const keyAgent = await this.stateService.getKeyAgent();

		if (keyAgent === null) {
			return {
				kind: 'not_running',
			};
		}

		try {
			const client = new KeyAgentClient(keyAgent.socket);
			try {
				const request = new KeyAgentPingRequest({
					token: keyAgent.token,
					type: 'ping',
				});

				await client.ping(request);
			} finally {
				await client.close();
			}

			return {
				kind: 'ok',
			};
		} catch (error) {
			return {
				error: String(error),
				kind: 'failed',
			};
		}
	}

	async start(): Promise<KeyAgentStartResult> {
		const runningKeyAgent = await this.getRunningKeyAgent();

		if (runningKeyAgent !== null) {
			return {
				key_agent: runningKeyAgent,
				kind: 'running',
			};
		}

		await this.cleanupStaleKeyAgent();
		this.spawnServeProcess();

		for (const delayMs of KEY_AGENT_STARTUP_DELAYS) {
			await sleep(delayMs);

			const keyAgent = await this.getRunningKeyAgent();

			if (keyAgent !== null) {
				return {
					key_agent: keyAgent,
					kind: 'started',
				};
			}
		}

		return {
			kind: 'timeout',
		};
	}

	async stop(): Promise<KeyAgentStopResult> {
		const keyAgent = await this.stateService.getKeyAgent();

		if (keyAgent === null) {
			return {
				kind: 'not_running',
			};
		}

		const pidAlive = isProcessAlive(keyAgent.pid);

		if (!pidAlive) {
			await this.stateService.clearKeyAgentIfMatches(keyAgent.pid, keyAgent.token);

			return {
				kind: 'not_running',
			};
		}

		await this.sendShutdown(keyAgent);
		await this.waitForProcessExit(keyAgent.pid, KEY_AGENT_SHUTDOWN_TIMEOUT_MS);

		if (isProcessAlive(keyAgent.pid)) {
			forceKill(keyAgent.pid);
			await sleep(100);
			await this.stateService.clearKeyAgentIfMatches(keyAgent.pid, keyAgent.token);
		}

		return {
			key_agent: keyAgent,
			kind: 'stopped',
		};
	}

	private async cleanupStaleKeyAgent(): Promise<void> {
		const keyAgent = await this.stateService.getKeyAgent();

		if (keyAgent === null) {
			return;
		}

		const pidAlive = isProcessAlive(keyAgent.pid);
		const respondsToPing = pidAlive ? await this.respondsToPing(keyAgent) : false;

		if (pidAlive && !respondsToPing) {
			forceKill(keyAgent.pid);
			await sleep(100);
		}

		await this.stateService.clearKeyAgentIfMatches(keyAgent.pid, keyAgent.token);
	}

	private async getRunningKeyAgent(): Promise<KeyAgentState | null> {
		const keyAgent = await this.stateService.getKeyAgent();

		if (keyAgent === null) {
			return null;
		}

		const pidAlive = isProcessAlive(keyAgent.pid);

		if (!pidAlive) {
			await this.stateService.clearKeyAgentIfMatches(keyAgent.pid, keyAgent.token);
			return null;
		}

		const respondsToPing = await this.respondsToPing(keyAgent);

		if (!respondsToPing) {
			await this.stateService.clearKeyAgentIfMatches(keyAgent.pid, keyAgent.token);
			return null;
		}

		return keyAgent;
	}

	private async respondsToPing(keyAgent: KeyAgentState): Promise<boolean> {
		try {
			const client = new KeyAgentClient(keyAgent.socket);
			let response: KeyAgentPingResponse;

			try {
				const request = new KeyAgentPingRequest({
					token: keyAgent.token,
					type: 'ping',
				});
				response = await client.ping(request);
			} finally {
				await client.close();
			}

			return response.ok && response.type === 'ping';
		} catch {
			return false;
		}
	}

	private async sendShutdown(keyAgent: KeyAgentState): Promise<void> {
		try {
			const client = new KeyAgentClient(keyAgent.socket);
			let response: KeyAgentShutdownResponse;

			try {
				const request = new KeyAgentShutdownRequest({
					token: keyAgent.token,
					type: 'shutdown',
				});
				response = await client.shutdown(request);
			} finally {
				await client.close();
			}
			const isValidShutdown = response.ok && response.type === 'shutdown';

			if (!isValidShutdown) {
				throw new Error('invalid shutdown response');
			}
		} catch {
			// Ignore and fall back to force kill after timeout.
		}
	}

	private spawnServeProcess(): void {
		const currentArg = process.argv[1];
		const isScriptMode = isScriptEntryPoint(currentArg);
		const args = isScriptMode ? [currentArg, 'key-agent', 'serve'] : ['key-agent', 'serve'];
		const child = child_process.spawn(process.execPath, args, {
			cwd: process.cwd(),
			detached: true,
			stdio: 'ignore',
			windowsHide: true,
		});

		child.unref();
	}

	private async waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
		const startedAt = Date.now();

		while (Date.now() - startedAt < timeoutMs) {
			const alive = isProcessAlive(pid);
			if (alive) {
				await sleep(100);
			} else {
				break;
			}
		}
	}
}

function isScriptEntryPoint(currentArg: string | undefined): currentArg is string {
	if (currentArg === undefined) {
		return false;
	}

	const extension = path.extname(currentArg).toLowerCase();

	return (
		extension === '.ts' ||
		extension === '.mts' ||
		extension === '.cts' ||
		extension === '.js' ||
		extension === '.mjs' ||
		extension === '.cjs'
	);
}
