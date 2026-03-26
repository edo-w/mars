import fsp from 'node:fs/promises';
import type { KeyAgentService } from '#src/cli/app/key-agent/key-agent-service';
import {
	createKeyAgentState,
	isRequestMessage,
	KEY_AGENT_IDLE_TIMEOUT_MS,
	KeyAgentDecryptRequest,
	KeyAgentEncryptRequest,
	KeyAgentErrorResponse,
	KeyAgentPingRequest,
	type KeyAgentResponse,
	KeyAgentShutdownRequest,
} from '#src/cli/app/key-agent/key-agent-shapes';
import type { StateService } from '#src/cli/app/state/state-service';
import { JsonRpcServer } from '#src/lib/json-rpc-server';
import type { JsonRpcServerErrorEvent, JsonRpcServerMessageEvent, RequestMessage } from '#src/lib/json-rpc-shapes';
import { PromiseSignal } from '#src/lib/promise-signal';
import { isMissingPathError } from '#src/lib/vfs';
import type { VLogger } from '#src/lib/vlogger';
import { vlogManager } from '#src/lib/vlogger';

export class KeyAgentServer {
	closeSignal: PromiseSignal | null;
	idleTimer: NodeJS.Timeout | null;
	jsonRpcServer: JsonRpcServer | null;
	keyAgentService: KeyAgentService;
	logger: VLogger;
	stateService: StateService;

	constructor(stateService: StateService, keyAgentService: KeyAgentService) {
		this.closeSignal = null;
		this.idleTimer = null;
		this.jsonRpcServer = null;
		this.keyAgentService = keyAgentService;
		this.logger = vlogManager.getLogger(['mars', 'key-agent', 'server']);
		this.stateService = stateService;
	}

	async serveAndWaitForClose(): Promise<void> {
		const keyAgent = createKeyAgentState(process.pid);
		const closeSignal = new PromiseSignal();
		const jsonRpcServer = new JsonRpcServer(keyAgent.socket);

		this.closeSignal = closeSignal;
		this.jsonRpcServer = jsonRpcServer;
		jsonRpcServer.onError((event) => {
			try {
				this.handleServerError(event);
			} catch (error) {
				this.logger.error(`key-agent server error handler failed: ${String(error)}`);
			}
		});
		jsonRpcServer.onMessage((event) => {
			void this.handleServerMessage(event).catch((error) => {
				this.logger.error(`key-agent server message handler failed: ${String(error)}`);
			});
		});

		await this.removeSocketFile(keyAgent.socket);
		await jsonRpcServer.listen();
		await this.stateService.setKeyAgent(keyAgent);
		this.logger.info(`key-agent server started on ${keyAgent.socket}`);
		this.resetIdleTimer();
		await closeSignal.wait();
		this.logger.info('key-agent server shutting down');
		await this.stateService.clearKeyAgentIfMatches(keyAgent.pid, keyAgent.token);
		await this.removeSocketFile(keyAgent.socket);
	}

	private async closeServer(): Promise<void> {
		const jsonRpcServer = this.jsonRpcServer;

		if (jsonRpcServer === null) {
			return;
		}

		this.removeIdleTimer();
		await jsonRpcServer.close();

		const closeSignal = this.closeSignal;

		if (closeSignal !== null) {
			closeSignal.resolve();
		}
	}

	private async handleMessage(event: JsonRpcServerMessageEvent): Promise<KeyAgentResponse> {
		const requestFields = event.message;
		const requestMessage = readKeyAgentRequestMessage(requestFields);

		this.resetIdleTimer();
		this.logger.info(`received key-agent request ${requestMessage.type}`);

		try {
			if (requestMessage.type === 'ping') {
				const request = new KeyAgentPingRequest(requestFields);

				return this.keyAgentService.ping(request);
			}

			if (requestMessage.type === 'shutdown') {
				const request = new KeyAgentShutdownRequest(requestFields);

				return this.keyAgentService.shutdown(request);
			}

			if (requestMessage.type === 'encrypt') {
				const request = new KeyAgentEncryptRequest(requestFields);

				return this.keyAgentService.encrypt(request);
			}

			if (requestMessage.type === 'decrypt') {
				const request = new KeyAgentDecryptRequest(requestFields);

				return this.keyAgentService.decrypt(request);
			}
		} catch (error) {
			const errorMessage = String(error);

			this.logger.error(`key-agent request ${requestMessage.type} failed: ${errorMessage}`);

			return new KeyAgentErrorResponse({
				error: errorMessage,
				ok: false,
				type: readKeyAgentRequestType(requestFields),
			});
		}

		const requestType = readKeyAgentRequestType(requestFields);

		throw new Error(`unknown request type "${requestType}"`);
	}

	private handleServerError(event: JsonRpcServerErrorEvent): void {
		this.logger.error(`json-rpc server error: ${String(event.error)}`);
	}

	private async handleServerMessage(event: JsonRpcServerMessageEvent): Promise<void> {
		const jsonRpcServer = this.jsonRpcServer;
		const response = await this.handleMessage(event);

		if (jsonRpcServer === null) {
			throw new Error('json-rpc server not available');
		}

		await jsonRpcServer.respond(event.socket_id, event.envelope_id, response);

		if (response.ok && response.type === 'shutdown') {
			await this.closeServer();
		}
	}

	private removeIdleTimer(): void {
		if (this.idleTimer === null) {
			return;
		}

		clearTimeout(this.idleTimer);
		this.idleTimer = null;
	}

	private async removeSocketFile(socketPath: string): Promise<void> {
		if (process.platform === 'win32') {
			return;
		}

		try {
			await fsp.rm(socketPath);
		} catch (error) {
			if (!isMissingPathError(error)) {
				throw error;
			}
		}
	}

	private resetIdleTimer(): void {
		this.removeIdleTimer();
		this.idleTimer = setTimeout(() => {
			this.logger.info('key-agent server idle timeout reached');
			void this.closeServer();
		}, KEY_AGENT_IDLE_TIMEOUT_MS);
	}
}

function readKeyAgentRequestType(fields: unknown): KeyAgentErrorResponse['type'] {
	if (fields === undefined) {
		return 'unknown';
	}

	const requestMessage = readKeyAgentRequestMessage(fields);

	if (requestMessage.type === 'decrypt') {
		return 'decrypt';
	}

	if (requestMessage.type === 'encrypt') {
		return 'encrypt';
	}

	if (requestMessage.type === 'shutdown') {
		return 'shutdown';
	}

	if (requestMessage.type === 'ping') {
		return 'ping';
	}

	throw new Error(`unknown request type "${requestMessage.type}"`);
}

function readKeyAgentRequestMessage(fields: unknown): RequestMessage {
	const requestIsValid = isRequestMessage(fields);

	if (!requestIsValid) {
		throw new Error('invalid key-agent request');
	}

	return fields;
}
