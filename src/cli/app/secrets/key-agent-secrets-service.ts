import type { Environment } from '#src/cli/app/environment/environment-shapes';
import { decryptBytes, encryptBytes } from '#src/cli/app/secrets/secrets-crypto';
import type { SecretsProviderFactory } from '#src/cli/app/secrets/secrets-provider-factory';
import type { SecretsService } from '#src/cli/app/secrets/secrets-service';
import type { EncryptedSecretRecord } from '#src/cli/app/secrets/secrets-shapes';

export class KeyAgentSecretsService implements SecretsService {
	secretsProviderFactory: SecretsProviderFactory;

	constructor(secretsProviderFactory: SecretsProviderFactory) {
		this.secretsProviderFactory = secretsProviderFactory;
	}

	async decryptText(environment: Environment, encryptedSecret: EncryptedSecretRecord): Promise<string> {
		const dataKey = await this.getDataKey(environment);
		const plaintext = await decryptBytes(dataKey, encryptedSecret);
		const textDecoder = new TextDecoder();

		return textDecoder.decode(plaintext);
	}

	async encryptText(environment: Environment, plaintext: string): Promise<EncryptedSecretRecord> {
		const dataKey = await this.getDataKey(environment);
		const textEncoder = new TextEncoder();
		const plaintextBytes = textEncoder.encode(plaintext);

		return encryptBytes(dataKey, plaintextBytes);
	}

	private async getDataKey(environment: Environment): Promise<Uint8Array> {
		const secretsProvider = await this.secretsProviderFactory.create();

		return secretsProvider.getDataKey(environment);
	}
}
