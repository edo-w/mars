import * as z from 'zod';

export const CONFIG_FILE = 'mars.config.json';
export const NAMESPACE = 'app';
export const ENVS_PATH = 'infra/envs';
export const WORK_PATH = '.mars';
export const S3_BUCKET = '{env}-infra-{aws_account_id}';

export interface LocalBackendConfig {
	local: Record<string, never>;
}

export interface S3BackendConfig {
	s3: {
		bucket: string;
	};
}

export type BackendConfig = LocalBackendConfig | S3BackendConfig;

export interface PasswordSecretsConfig {
	password: Record<string, never>;
}

export interface KmsSecretsConfig {
	kms: Record<string, never>;
}

export type SecretsConfig = PasswordSecretsConfig | KmsSecretsConfig;

const localBackendConfigSchema = z
	.object({
		local: z.object({}),
	})
	.strict();

const s3BackendConfigSchema = z
	.object({
		s3: z.object({
			bucket: z.string().min(1),
		}),
	})
	.strict();

const passwordSecretsConfigSchema = z
	.object({
		password: z.object({}),
	})
	.strict();

const kmsSecretsConfigSchema = z
	.object({
		kms: z.object({}),
	})
	.strict();

export class MarsConfig {
	static schema = z.object({
		namespace: z.string().min(1),
		envs_path: z.string().min(1),
		work_path: z.string().min(1).default(WORK_PATH),
		backend: z.union([localBackendConfigSchema, s3BackendConfigSchema]),
		secrets: z.union([passwordSecretsConfigSchema, kmsSecretsConfigSchema]),
	});

	namespace: string;
	envs_path: string;
	work_path: string;
	backend: BackendConfig;
	secrets: SecretsConfig;

	constructor(fields: unknown) {
		const parsed = MarsConfig.schema.parse(fields);

		this.namespace = parsed.namespace;
		this.envs_path = parsed.envs_path;
		this.work_path = parsed.work_path;
		this.backend = parsed.backend;
		this.secrets = parsed.secrets;
	}
}

export function createDefaultMarsConfig(): MarsConfig {
	return new MarsConfig({
		namespace: NAMESPACE,
		envs_path: ENVS_PATH,
		work_path: WORK_PATH,
		backend: {
			local: {},
		},
		secrets: {
			password: {},
		},
	});
}

export function isLocalBackendConfig(config: unknown): config is LocalBackendConfig {
	return typeof config === 'object' && config !== null && 'local' in config;
}

export function isS3BackendConfig(config: unknown): config is S3BackendConfig {
	return (
		typeof config === 'object' &&
		config !== null &&
		's3' in config &&
		typeof config.s3 === 'object' &&
		config.s3 !== null &&
		'bucket' in config.s3 &&
		typeof config.s3.bucket === 'string'
	);
}

export function isPasswordSecretsConfig(config: unknown): config is PasswordSecretsConfig {
	return typeof config === 'object' && config !== null && 'password' in config;
}

export function isKmsSecretsConfig(config: unknown): config is KmsSecretsConfig {
	return typeof config === 'object' && config !== null && 'kms' in config;
}
