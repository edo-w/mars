import path from 'node:path';
import * as z from 'zod';

export const ENVIRONMENTS_DIRECTORY = 'envs';
export const SECRETS_DIRECTORY = 'secrets';
export const DATA_KEY_FILE = 'datakey.enc';
export const KDF_FILE = 'kdf.json';
export const AES_GCM_ALGORITHM = 'AES-GCM';
export const AES_GCM_IV_LENGTH = 12;
export const DATA_KEY_LENGTH = 32;

export class EncryptedSecretRecord {
	static schema = z.object({
		algorithm: z.literal(AES_GCM_ALGORITHM),
		ciphertext: z.string().min(1),
		iv: z.string().min(1),
	});

	algorithm: 'AES-GCM';
	ciphertext: string;
	iv: string;

	constructor(fields: unknown) {
		const parsed = EncryptedSecretRecord.schema.parse(fields);

		this.algorithm = parsed.algorithm;
		this.ciphertext = parsed.ciphertext;
		this.iv = parsed.iv;
	}
}

export class PasswordSecretsKdfRecord {
	static schema = z.object({
		algorithm: z.literal('argon2id'),
		hash_length: z.number().int().positive(),
		memory_cost: z.number().int().positive(),
		parallelism: z.number().int().positive(),
		salt: z.string().min(1),
		time_cost: z.number().int().positive(),
	});

	algorithm: 'argon2id';
	hash_length: number;
	memory_cost: number;
	parallelism: number;
	salt: string;
	time_cost: number;

	constructor(fields: unknown) {
		const parsed = PasswordSecretsKdfRecord.schema.parse(fields);

		this.algorithm = parsed.algorithm;
		this.hash_length = parsed.hash_length;
		this.memory_cost = parsed.memory_cost;
		this.parallelism = parsed.parallelism;
		this.salt = parsed.salt;
		this.time_cost = parsed.time_cost;
	}
}

export function createSecretsDataKeyPath(environmentId: string): string {
	return path.posix.join(ENVIRONMENTS_DIRECTORY, environmentId, SECRETS_DIRECTORY, DATA_KEY_FILE);
}

export function createSecretsKdfPath(environmentId: string): string {
	return path.posix.join(ENVIRONMENTS_DIRECTORY, environmentId, SECRETS_DIRECTORY, KDF_FILE);
}

export function createKmsSecretsKeyAlias(environmentId: string): string {
	return `alias/mars-${environmentId}-secrets`;
}

export function toBase64(value: Uint8Array): string {
	return Buffer.from(value).toString('base64');
}

export function fromBase64(value: string): Uint8Array {
	return Uint8Array.from(Buffer.from(value, 'base64'));
}
