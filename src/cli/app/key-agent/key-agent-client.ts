import {
	isResponseMessage,
	type KeyAgentDecryptRequest,
	KeyAgentDecryptResponse,
	type KeyAgentEncryptRequest,
	KeyAgentEncryptResponse,
	type KeyAgentPingRequest,
	KeyAgentPingResponse,
	type KeyAgentShutdownRequest,
	KeyAgentShutdownResponse,
} from '#src/cli/app/key-agent/key-agent-shapes';
import { JsonRpcClient } from '#src/lib/json-rpc';

export class KeyAgentClient {
	jsonRpcClient: JsonRpcClient;

	constructor(socketPath: string) {
		this.jsonRpcClient = new JsonRpcClient(socketPath);
	}

	async close(): Promise<void> {
		await this.jsonRpcClient.close();
	}

	setKeepAlive(keepAlive: boolean): void {
		this.jsonRpcClient.setKeepAlive(keepAlive);
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
}
