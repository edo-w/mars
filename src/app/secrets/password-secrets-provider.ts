import argon2, { argon2id } from 'argon2';
import type { BackendFactory } from '#src/app/backend/backend-factory';
import type { Environment } from '#src/app/environment/environment-shapes';
import { decryptBytes, encryptBytes } from '#src/app/secrets/secrets-crypto';
import type { SecretsInfo, SecretsProvider } from '#src/app/secrets/secrets-provider';
import {
	createSecretsDataKeyPath,
	createSecretsKdfPath,
	DATA_KEY_LENGTH,
	EncryptedSecretRecord,
	fromBase64,
	PasswordSecretsKdfRecord,
	toBase64,
} from '#src/app/secrets/secrets-shapes';

export class PasswordSecretsProvider implements SecretsProvider {
	backendFactory: BackendFactory;

	constructor(backendFactory: BackendFactory) {
		this.backendFactory = backendFactory;
	}

	async getDataKey(environment: Environment): Promise<Uint8Array> {
		const backendService = await this.backendFactory.create();
		const dataKeyPath = createSecretsDataKeyPath(environment.id);
		const kdfPath = createSecretsKdfPath(environment.id);
		const dataKeyExists = await backendService.fileExists(environment, dataKeyPath);
		const kdfExists = await backendService.fileExists(environment, kdfPath);

		if (dataKeyExists !== kdfExists) {
			throw new Error(`password secrets for "${environment.id}" are corrupted`);
		}

		if (!dataKeyExists) {
			return this.createDataKey(environment, dataKeyPath, kdfPath);
		}

		const password = this.getPassword(environment.id);
		const encryptedDataKeyText = await backendService.readTextFile(environment, dataKeyPath);
		const kdfText = await backendService.readTextFile(environment, kdfPath);
		const encryptedDataKey = new EncryptedSecretRecord(JSON.parse(encryptedDataKeyText) as unknown);
		const kdf = new PasswordSecretsKdfRecord(JSON.parse(kdfText) as unknown);
		const wrappingKey = await this.deriveWrappingKey(password, kdf);

		return decryptBytes(wrappingKey, encryptedDataKey);
	}

	async getInfo(_environment: Environment): Promise<SecretsInfo> {
		return {
			fields: [],
			type: 'password',
		};
	}

	private async createDataKey(environment: Environment, dataKeyPath: string, kdfPath: string): Promise<Uint8Array> {
		const backendService = await this.backendFactory.create();
		const password = this.getPassword(environment.id);
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const kdf = new PasswordSecretsKdfRecord({
			algorithm: 'argon2id',
			hash_length: DATA_KEY_LENGTH,
			memory_cost: 65536,
			parallelism: 4,
			salt: toBase64(salt),
			time_cost: 3,
		});
		const dataKey = crypto.getRandomValues(new Uint8Array(DATA_KEY_LENGTH));
		const wrappingKey = await this.deriveWrappingKey(password, kdf);
		const encryptedDataKey = await encryptBytes(wrappingKey, dataKey);
		const encryptedDataKeyText = `${JSON.stringify(encryptedDataKey, null, 2)}\n`;
		const kdfText = `${JSON.stringify(kdf, null, 2)}\n`;

		await backendService.writeTextFile(environment, dataKeyPath, encryptedDataKeyText);
		await backendService.writeTextFile(environment, kdfPath, kdfText);

		return dataKey;
	}

	private async deriveWrappingKey(password: string, kdf: PasswordSecretsKdfRecord): Promise<Uint8Array> {
		const wrappingKey = await argon2.hash(password, {
			hashLength: kdf.hash_length,
			memoryCost: kdf.memory_cost,
			parallelism: kdf.parallelism,
			raw: true,
			salt: Buffer.from(fromBase64(kdf.salt)),
			timeCost: kdf.time_cost,
			type: argon2id,
		});

		return Uint8Array.from(wrappingKey);
	}

	private getPassword(environmentId: string): string {
		const envName = environmentId.toUpperCase().replaceAll('-', '_');
		const scopedPassword = process.env[`MARS_SECRETS_PASSWORD_${envName}`];
		const password = scopedPassword ?? process.env.MARS_SECRETS_PASSWORD;

		if (password === undefined || password.length === 0) {
			throw new Error(`missing secrets password for "${environmentId}"`);
		}

		return password;
	}
}
