import type { EnvironmentService } from '#src/app/environment/environment-service';
import {
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
import { decryptBytes, encryptBytes } from '#src/app/secrets/secrets-crypto';
import type { SecretsProviderFactory } from '#src/app/secrets/secrets-provider-factory';
import { fromBase64, toBase64 } from '#src/app/secrets/secrets-shapes';

export class KeyAgentService {
	askpassEntries: Map<string, { expire_at: number; password: string }>;
	dataKeys: Map<string, Uint8Array>;
	environmentService: EnvironmentService;
	secretsProviderFactory: SecretsProviderFactory;

	constructor(environmentService: EnvironmentService, secretsProviderFactory: SecretsProviderFactory) {
		this.askpassEntries = new Map();
		this.dataKeys = new Map();
		this.environmentService = environmentService;
		this.secretsProviderFactory = secretsProviderFactory;
	}

	clearAskpass(request: KeyAgentClearAskpassRequest): KeyAgentClearAskpassResponse {
		this.cleanupAskpassEntries();
		this.askpassEntries.delete(request.askpass_token);

		return new KeyAgentClearAskpassResponse({
			ok: true,
			type: 'clear-askpass',
		});
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

	getAskpass(request: KeyAgentGetAskpassRequest): KeyAgentGetAskpassResponse {
		this.cleanupAskpassEntries();

		const askpassEntry = this.askpassEntries.get(request.askpass_token);

		if (askpassEntry === undefined) {
			throw new Error('askpass token not found');
		}

		this.askpassEntries.delete(request.askpass_token);

		return new KeyAgentGetAskpassResponse({
			ok: true,
			password: askpassEntry.password,
			type: 'get-askpass',
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

	setAskpass(request: KeyAgentSetAskpassRequest): KeyAgentSetAskpassResponse {
		this.cleanupAskpassEntries();

		const askpassToken = crypto.randomUUID();

		this.askpassEntries.set(askpassToken, {
			expire_at: Date.now() + request.ttl_ms,
			password: request.password,
		});

		return new KeyAgentSetAskpassResponse({
			askpass_token: askpassToken,
			ok: true,
			type: 'set-askpass',
		});
	}

	private cleanupAskpassEntries(): void {
		const now = Date.now();

		for (const [token, entry] of this.askpassEntries.entries()) {
			if (entry.expire_at <= now) {
				this.askpassEntries.delete(token);
			}
		}
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
