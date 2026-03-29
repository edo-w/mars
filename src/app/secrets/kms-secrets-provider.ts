import { DecryptCommand, DescribeKeyCommand, EncryptCommand, type KMSClient } from '@aws-sdk/client-kms';
import type { BackendFactory } from '#src/app/backend/backend-factory';
import type { Environment } from '#src/app/environment/environment-shapes';
import type { SecretsInfo, SecretsProvider } from '#src/app/secrets/secrets-provider';
import {
	createKmsSecretsKeyAlias,
	createSecretsDataKeyPath,
	DATA_KEY_LENGTH,
	fromBase64,
	toBase64,
} from '#src/app/secrets/secrets-shapes';

export class KmsSecretsProvider implements SecretsProvider {
	backendFactory: BackendFactory;
	kmsClient: KMSClient;

	constructor(backendFactory: BackendFactory, kmsClient: KMSClient) {
		this.backendFactory = backendFactory;
		this.kmsClient = kmsClient;
	}

	async getDataKey(environment: Environment): Promise<Uint8Array> {
		const backendService = await this.backendFactory.create();
		const dataKeyPath = createSecretsDataKeyPath(environment.id);

		if (!(await backendService.fileExists(environment, dataKeyPath))) {
			return this.createDataKey(environment, dataKeyPath);
		}

		const ciphertext = await backendService.readTextFile(environment, dataKeyPath);
		const result = await this.kmsClient.send(
			new DecryptCommand({
				CiphertextBlob: fromBase64(ciphertext.trim()),
			}),
		);

		if (result.Plaintext === undefined) {
			throw new Error(`failed to unwrap data key for "${environment.id}"`);
		}

		return Uint8Array.from(result.Plaintext as Uint8Array);
	}

	async getInfo(environment: Environment): Promise<SecretsInfo> {
		const keyAlias = createKmsSecretsKeyAlias(environment.id);
		const keyId = await this.getKeyId(keyAlias);

		return {
			fields: [
				{
					name: 'kms_key_id',
					value: keyId ?? 'not found',
				},
				{
					name: 'kms_key_alias',
					value: keyAlias,
				},
			],
			type: 'kms',
		};
	}

	private async createDataKey(environment: Environment, dataKeyPath: string): Promise<Uint8Array> {
		const backendService = await this.backendFactory.create();
		const dataKey = crypto.getRandomValues(new Uint8Array(DATA_KEY_LENGTH));
		const result = await this.kmsClient.send(
			new EncryptCommand({
				KeyId: createKmsSecretsKeyAlias(environment.id),
				Plaintext: dataKey,
			}),
		);

		if (result.CiphertextBlob === undefined) {
			throw new Error(`failed to wrap data key for "${environment.id}"`);
		}

		const ciphertext = toBase64(Uint8Array.from(result.CiphertextBlob as Uint8Array));

		await backendService.writeTextFile(environment, dataKeyPath, ciphertext);

		return dataKey;
	}

	private async getKeyId(keyAlias: string): Promise<string | null> {
		try {
			const result = await this.kmsClient.send(
				new DescribeKeyCommand({
					KeyId: keyAlias,
				}),
			);
			const keyId = result.KeyMetadata?.KeyId;

			return keyId ?? null;
		} catch {
			return null;
		}
	}
}
