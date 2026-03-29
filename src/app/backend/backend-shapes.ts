import path from 'node:path';
import type { MarsConfig } from '#src/app/config/config-shapes';
import type { Environment, EnvironmentResource } from '#src/app/environment/environment-shapes';

export interface BackendInfoField {
	name: string;
	value: string;
}

export interface BackendInfo {
	fields: BackendInfoField[];
	type: 'local' | 's3';
}

export interface BackendDestroySuccessResult {
	kind: 'success';
	resources: EnvironmentResource[];
}

export interface BackendDestroyFailResult {
	error: unknown;
	kind: 'fail';
	resources: EnvironmentResource[];
}

export type BackendDestroyResult = BackendDestroySuccessResult | BackendDestroyFailResult;

export function createS3BucketResource(bucket: string, status: 'destroy' | 'not_found'): EnvironmentResource {
	return {
		kind: 's3_bucket',
		label: `s3 bucket "${bucket}"`,
		status,
	};
}

export function renderS3BucketName(environment: Environment, config: MarsConfig, bucketTemplate: string): string {
	return bucketTemplate
		.replaceAll('{namespace}', config.namespace)
		.replaceAll('{env_name}', environment.config.name)
		.replaceAll('{env}', environment.id)
		.replaceAll('{aws_account_id}', environment.config.aws_account_id)
		.replaceAll('{aws_region}', environment.config.aws_region);
}

export function resolveLocalBackendPath(workPath: string): string {
	return path.posix.join(workPath, 'local');
}
