import type { Environment } from '#src/app/environment/environment-shapes';
import { KeyAgentClient } from '#src/app/key-agent/key-agent-client';
import type { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import { KeyAgentDecryptRequest, KeyAgentEncryptRequest } from '#src/app/key-agent/key-agent-shapes';
import type { SecretsService } from '#src/app/secrets/secrets-service';
import type { EncryptedSecretRecord } from '#src/app/secrets/secrets-shapes';
import { fromBase64, toBase64 } from '#src/app/secrets/secrets-shapes';

export class KeyAgentSecretsService implements SecretsService {
	keyAgentClient: KeyAgentClient | null;
	keyAgentSocketPath: string | null;
	keyAgentManager: KeyAgentManager;

	constructor(keyAgentManager: KeyAgentManager) {
		this.keyAgentClient = null;
		this.keyAgentManager = keyAgentManager;
		this.keyAgentSocketPath = null;
	}

	async decryptBytes(environment: Environment, encryptedSecret: EncryptedSecretRecord): Promise<Uint8Array> {
		const keyAgent = await this.keyAgentManager.ensureRunning();
		const client = this.getKeyAgentClient(keyAgent.socket);
		const request = new KeyAgentDecryptRequest({
			encrypted_secret: encryptedSecret,
			environment: environment.id,
			token: keyAgent.token,
			type: 'decrypt',
		});
		const response = await client.decrypt(request);

		return fromBase64(response.plaintext);
	}

	async decryptText(environment: Environment, encryptedSecret: EncryptedSecretRecord): Promise<string> {
		const plaintextBytes = await this.decryptBytes(environment, encryptedSecret);
		const plaintext = new TextDecoder().decode(plaintextBytes);

		return plaintext;
	}

	async encryptBytes(environment: Environment, plaintext: Uint8Array): Promise<EncryptedSecretRecord> {
		const keyAgent = await this.keyAgentManager.ensureRunning();
		const client = this.getKeyAgentClient(keyAgent.socket);
		const request = new KeyAgentEncryptRequest({
			environment: environment.id,
			plaintext: toBase64(plaintext),
			token: keyAgent.token,
			type: 'encrypt',
		});
		const response = await client.encrypt(request);

		return response.encrypted_secret;
	}

	async encryptText(environment: Environment, plaintext: string): Promise<EncryptedSecretRecord> {
		const plaintextBytes = new TextEncoder().encode(plaintext);

		return this.encryptBytes(environment, plaintextBytes);
	}

	private getKeyAgentClient(socketPath: string): KeyAgentClient {
		const currentClient = this.keyAgentClient;
		const canReuseClient = currentClient !== null && this.keyAgentSocketPath === socketPath;

		if (canReuseClient) {
			return currentClient;
		}

		const keyAgentClient = new KeyAgentClient(socketPath);

		this.keyAgentClient = keyAgentClient;
		this.keyAgentSocketPath = socketPath;

		return keyAgentClient;
	}
}
