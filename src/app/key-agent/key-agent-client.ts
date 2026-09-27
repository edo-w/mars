import {
	isResponseMessage,
	type KeyAgentClearAskpassRequest,
	KeyAgentClearAskpassResponse,
	type KeyAgentDecryptRequest,
	KeyAgentDecryptResponse,
	type KeyAgentEncryptRequest,
	KeyAgentEncryptResponse,
	type KeyAgentGetAskpassRequest,
	KeyAgentGetAskpassResponse,
	type KeyAgentPingRequest,
	KeyAgentPingResponse,
	type KeyAgentSetAskpassRequest,
	KeyAgentSetAskpassResponse,
	type KeyAgentShutdownRequest,
	KeyAgentShutdownResponse,
} from '#src/app/key-agent/key-agent-shapes';
import { JsonRpcClient } from '#src/lib/json-rpc';
import type { VTimer } from '#src/lib/vtimer';
import { VTimer as RealVTimer } from '#src/lib/vtimer';

export class KeyAgentClient {
	jsonRpcClient: JsonRpcClient;

	constructor(socketPath: string, vtimer: VTimer = new RealVTimer()) {
		this.jsonRpcClient = new JsonRpcClient(socketPath, vtimer);
	}

	async close(): Promise<void> {
		await this.jsonRpcClient.close();
	}

	setKeepAlive(keepAlive: boolean): void {
		this.jsonRpcClient.setKeepAlive(keepAlive);
	}

	async clearAskpass(request: KeyAgentClearAskpassRequest): Promise<KeyAgentClearAskpassResponse> {
		const response = await this.jsonRpcClient.send(request);
		const responseIsValid = isResponseMessage(response);

		if (!responseIsValid) {
			throw new Error('invalid clear-askpass response');
		}

		if (!response.ok) {
			throw new Error(response.error);
		}

		if (response.type === 'clear-askpass') {
			return new KeyAgentClearAskpassResponse(response);
		}

		throw new Error('invalid clear-askpass response');
	}

	async decrypt(request: KeyAgentDecryptRequest): Promise<KeyAgentDecryptResponse> {
		const response = await this.jsonRpcClient.send(request);
		const responseIsValid = isResponseMessage(response);

		if (!responseIsValid) {
			throw new Error('invalid decrypt response');
		}

		if (!response.ok) {
			throw new Error(response.error);
		}

		if (response.type === 'decrypt') {
			return new KeyAgentDecryptResponse(response);
		}

		throw new Error('invalid decrypt response');
	}

	async encrypt(request: KeyAgentEncryptRequest): Promise<KeyAgentEncryptResponse> {
		const response = await this.jsonRpcClient.send(request);
		const responseIsValid = isResponseMessage(response);

		if (!responseIsValid) {
			throw new Error('invalid encrypt response');
		}

		if (!response.ok) {
			throw new Error(response.error);
		}

		if (response.type === 'encrypt') {
			return new KeyAgentEncryptResponse(response);
		}

		throw new Error('invalid encrypt response');
	}

	async getAskpass(request: KeyAgentGetAskpassRequest): Promise<KeyAgentGetAskpassResponse> {
		const response = await this.jsonRpcClient.send(request);
		const responseIsValid = isResponseMessage(response);

		if (!responseIsValid) {
			throw new Error('invalid get-askpass response');
		}

		if (!response.ok) {
			throw new Error(response.error);
		}

		if (response.type === 'get-askpass') {
			return new KeyAgentGetAskpassResponse(response);
		}

		throw new Error('invalid get-askpass response');
	}

	async ping(request: KeyAgentPingRequest): Promise<KeyAgentPingResponse> {
		const response = await this.jsonRpcClient.send(request);
		const responseIsValid = isResponseMessage(response);

		if (!responseIsValid) {
			throw new Error('invalid ping response');
		}

		if (!response.ok) {
			throw new Error(response.error);
		}

		if (response.type === 'ping') {
			return new KeyAgentPingResponse(response);
		}

		throw new Error('invalid ping response');
	}

	async shutdown(request: KeyAgentShutdownRequest): Promise<KeyAgentShutdownResponse> {
		const response = await this.jsonRpcClient.send(request);
		const responseIsValid = isResponseMessage(response);

		if (!responseIsValid) {
			throw new Error('invalid shutdown response');
		}

		if (!response.ok) {
			throw new Error(response.error);
		}

		if (response.type === 'shutdown') {
			return new KeyAgentShutdownResponse(response);
		}

		throw new Error('invalid shutdown response');
	}

	async setAskpass(request: KeyAgentSetAskpassRequest): Promise<KeyAgentSetAskpassResponse> {
		const response = await this.jsonRpcClient.send(request);
		const responseIsValid = isResponseMessage(response);

		if (!responseIsValid) {
			throw new Error('invalid set-askpass response');
		}

		if (!response.ok) {
			throw new Error(response.error);
		}

		if (response.type === 'set-askpass') {
			return new KeyAgentSetAskpassResponse(response);
		}

		throw new Error('invalid set-askpass response');
	}
}
