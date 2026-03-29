import type { EnvironmentService } from '#src/app/environment/environment-service';
import {
	type KeyAgentDecryptRequest,
	KeyAgentDecryptResponse,
	type KeyAgentEncryptRequest,
	KeyAgentEncryptResponse,
	type KeyAgentPingRequest,
	KeyAgentPingResponse,
	type KeyAgentShutdownRequest,
	KeyAgentShutdownResponse,
} from '#src/app/key-agent/key-agent-shapes';
import { decryptBytes, encryptBytes } from '#src/app/secrets/secrets-crypto';
import type { SecretsProviderFactory } from '#src/app/secrets/secrets-provider-factory';
import { fromBase64, toBase64 } from '#src/app/secrets/secrets-shapes';

export class KeyAgentService {
	dataKeys: Map<string, Uint8Array>;
	environmentService: EnvironmentService;
	secretsProviderFactory: SecretsProviderFactory;

	constructor(environmentService: EnvironmentService, secretsProviderFactory: SecretsProviderFactory) {
		this.dataKeys = new Map();
		this.environmentService = environmentService;
		this.secretsProviderFactory = secretsProviderFactory;
	}

	async decrypt(request: KeyAgentDecryptRequest): Promise<KeyAgentDecryptResponse> {
		const environment = await this.environmentService.get(request.environment);

		if (environment === null) {
			throw new Error(`environment "${request.environment}" not found`);
		}

		const dataKey = await this.getDataKey(request.environment);
		const plaintext = await decryptBytes(dataKey, request.encrypted_secret);

		return new KeyAgentDecryptResponse({
			ok: true,
			plaintext: toBase64(plaintext),
			type: 'decrypt',
		});
	}

	async encrypt(request: KeyAgentEncryptRequest): Promise<KeyAgentEncryptResponse> {
		const environment = await this.environmentService.get(request.environment);

		if (environment === null) {
			throw new Error(`environment "${request.environment}" not found`);
		}

		const dataKey = await this.getDataKey(request.environment);
		const encryptedSecret = await encryptBytes(dataKey, fromBase64(request.plaintext));

		return new KeyAgentEncryptResponse({
			encrypted_secret: encryptedSecret,
			ok: true,
			type: 'encrypt',
		});
	}

	ping(_request: KeyAgentPingRequest): KeyAgentPingResponse {
		return new KeyAgentPingResponse({
			ok: true,
			type: 'ping',
		});
	}

	shutdown(_request: KeyAgentShutdownRequest): KeyAgentShutdownResponse {
		return new KeyAgentShutdownResponse({
			ok: true,
			type: 'shutdown',
		});
	}

	private async getDataKey(environmentId: string): Promise<Uint8Array> {
		const cachedDataKey = this.dataKeys.get(environmentId);

		if (cachedDataKey !== undefined) {
			return cachedDataKey;
		}

		const environment = await this.environmentService.get(environmentId);

		if (environment === null) {
			throw new Error(`environment "${environmentId}" not found`);
		}

		const secretsProvider = await this.secretsProviderFactory.create();
		const dataKey = await secretsProvider.getDataKey(environment);

		this.dataKeys.set(environmentId, dataKey);

		return dataKey;
	}
}
