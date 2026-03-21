import * as z from 'zod';

export const ENVIRONMENT_FILE = 'environment.yml';

export class EnvironmentConfig {
	static schema = z.object({
		name: z.string().min(1),
		namespace: z.string().min(1),
		aws_account_id: z.string().min(1),
		aws_region: z.string().min(1),
	});

	name: string;
	namespace: string;
	aws_account_id: string;
	aws_region: string;

	constructor(fields: unknown) {
		const parsed = EnvironmentConfig.schema.parse(fields);

		this.name = parsed.name;
		this.namespace = parsed.namespace;
		this.aws_account_id = parsed.aws_account_id;
		this.aws_region = parsed.aws_region;
	}

	get id(): string {
		return `${this.namespace}-${this.name}`;
	}
}

export interface Environment {
	config: EnvironmentConfig;
	configPath: string;
	directoryPath: string;
	id: string;
	selected: boolean;
}

export interface BootstrapEnvironmentAlreadyExistsResult {
	kind: 'already_exists';
	bucket: string;
}

export interface BootstrapEnvironmentCreatedResult {
	kind: 'created';
	bucket: string;
}

export interface BootstrapEnvironmentNotFoundResult {
	kind: 'not_found';
	name: string;
}

export interface BootstrapEnvironmentNotSelectedResult {
	kind: 'not_selected';
}

export type BootstrapEnvironmentBucketResult =
	| BootstrapEnvironmentAlreadyExistsResult
	| BootstrapEnvironmentCreatedResult
	| BootstrapEnvironmentNotFoundResult
	| BootstrapEnvironmentNotSelectedResult;
