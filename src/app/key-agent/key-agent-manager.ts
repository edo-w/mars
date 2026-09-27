import type { KeyAgentClientFactory } from '#src/app/key-agent/key-agent-client-factory';
import {
	KEY_AGENT_ASKPASS_TTL_MS,
	KEY_AGENT_SHUTDOWN_TIMEOUT_MS,
	KEY_AGENT_STARTUP_DELAYS,
	KeyAgentClearAskpassRequest,
	KeyAgentGetAskpassRequest,
	KeyAgentPingRequest,
	type KeyAgentPingResponse,
	type KeyAgentPingResult,
	KeyAgentSetAskpassRequest,
	type KeyAgentShowResult,
	KeyAgentShutdownRequest,
	type KeyAgentShutdownResponse,
	type KeyAgentStartResult,
	type KeyAgentStopResult,
} from '#src/app/key-agent/key-agent-shapes';
import type { StateService } from '#src/app/state/state-service';
import type { KeyAgentState } from '#src/app/state/state-shapes';
import type { VProcess } from '#src/lib/vprocess';
import type { VTimer } from '#src/lib/vtimer';

export class KeyAgentManager {
	private readonly keyAgentClientFactory: KeyAgentClientFactory;
	private readonly stateService: StateService;
	private readonly vprocess: VProcess;
	private readonly vtimer: VTimer;

	constructor(
		stateService: StateService,
		vprocess: VProcess,
		keyAgentClientFactory: KeyAgentClientFactory,
		vtimer: VTimer,
	) {
		this.keyAgentClientFactory = keyAgentClientFactory;
		this.stateService = stateService;
		this.vprocess = vprocess;
		this.vtimer = vtimer;
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
			const client = this.keyAgentClientFactory.create(keyAgent.socket);
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

	async clearAskpass(token: string): Promise<void> {
		const keyAgent = await this.stateService.getKeyAgent();

		if (keyAgent === null) {
			return;
		}

		const client = this.keyAgentClientFactory.create(keyAgent.socket);

		try {
			await client.clearAskpass(
				new KeyAgentClearAskpassRequest({
					askpass_token: token,
					token: keyAgent.token,
					type: 'clear-askpass',
				}),
			);
		} finally {
			await client.close();
		}
	}

	async getAskpass(token: string): Promise<string> {
		const keyAgent = await this.stateService.getKeyAgent();

		if (keyAgent === null) {
			throw new Error('key-agent is not running');
		}

		const client = this.keyAgentClientFactory.create(keyAgent.socket);

		try {
			const response = await client.getAskpass(
				new KeyAgentGetAskpassRequest({
					askpass_token: token,
					token: keyAgent.token,
					type: 'get-askpass',
				}),
			);

			return response.password;
		} finally {
			await client.close();
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
			await this.vtimer.sleep(delayMs);

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

		const pidAlive = this.vprocess.isProcessAlive(keyAgent.pid);

		if (!pidAlive) {
			await this.stateService.clearKeyAgentIfMatches(keyAgent.pid, keyAgent.token);

			return {
				kind: 'not_running',
			};
		}

		await this.sendShutdown(keyAgent);
		await this.waitForProcessExit(keyAgent.pid, KEY_AGENT_SHUTDOWN_TIMEOUT_MS);

		if (this.vprocess.isProcessAlive(keyAgent.pid)) {
			this.vprocess.forceKill(keyAgent.pid);
			await this.vtimer.sleep(100);
			await this.stateService.clearKeyAgentIfMatches(keyAgent.pid, keyAgent.token);
		}

		return {
			key_agent: keyAgent,
			kind: 'stopped',
		};
	}

	async setAskpass(password: string, ttlMs: number = KEY_AGENT_ASKPASS_TTL_MS): Promise<string> {
		const keyAgent = await this.ensureRunning();
		const client = this.keyAgentClientFactory.create(keyAgent.socket);

		try {
			const response = await client.setAskpass(
				new KeyAgentSetAskpassRequest({
					password,
					token: keyAgent.token,
					ttl_ms: ttlMs,
					type: 'set-askpass',
				}),
			);

			return response.askpass_token;
		} finally {
			await client.close();
		}
	}

	private async cleanupStaleKeyAgent(): Promise<void> {
		const keyAgent = await this.stateService.getKeyAgent();

		if (keyAgent === null) {
			return;
		}

		const pidAlive = this.vprocess.isProcessAlive(keyAgent.pid);
		const respondsToPing = pidAlive ? await this.respondsToPing(keyAgent) : false;

		if (pidAlive && !respondsToPing) {
			this.vprocess.forceKill(keyAgent.pid);
			await this.vtimer.sleep(100);
		}

		await this.stateService.clearKeyAgentIfMatches(keyAgent.pid, keyAgent.token);
	}

	private async getRunningKeyAgent(): Promise<KeyAgentState | null> {
		const keyAgent = await this.stateService.getKeyAgent();

		if (keyAgent === null) {
			return null;
		}

		const pidAlive = this.vprocess.isProcessAlive(keyAgent.pid);

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
			const client = this.keyAgentClientFactory.create(keyAgent.socket);
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
			const client = this.keyAgentClientFactory.create(keyAgent.socket);
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
		const invocation = this.vprocess.getProcessInvocation(['key-agent', 'serve']);
		this.vprocess.spawnDetached(invocation.command, invocation.args, this.vprocess.cwd());
	}

	private async waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
		const startedAt = Date.now();

		while (Date.now() - startedAt < timeoutMs) {
			const alive = this.vprocess.isProcessAlive(pid);
			if (alive) {
				await this.vtimer.sleep(100);
			} else {
				break;
			}
		}
	}
}
