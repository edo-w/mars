import type { EnvironmentResource } from '#src/app/environment/environment-shapes';

export function createKmsKeyResource(keyAlias: string, status: 'destroy' | 'not_found'): EnvironmentResource {
	return {
		kind: 'kms_key',
		label: `kms key "${keyAlias}"`,
		status,
	};
}
