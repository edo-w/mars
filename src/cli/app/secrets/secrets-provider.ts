import type { Environment } from '#src/cli/app/environment/environment-shapes';

export interface SecretsInfoField {
	name: string;
	value: string;
}

export interface SecretsInfo {
	fields: SecretsInfoField[];
	type: 'password' | 'kms';
}

export interface SecretsProvider {
	getDataKey(environment: Environment): Promise<Uint8Array>;
	getInfo(environment: Environment): Promise<SecretsInfo>;
}
