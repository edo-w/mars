import type { Environment, EnvironmentResource } from '#src/app/environment/environment-shapes';
import type {
	SecretsBootstrapper,
	SecretsBootstrapResult,
	SecretsDestroyResult,
} from '#src/app/secrets/secrets-bootstrapper';

export class PasswordSecretsBootstrapper implements SecretsBootstrapper {
	async bootstrap(_environment: Environment): Promise<SecretsBootstrapResult> {
		return {
			kind: 'noop',
		};
	}

	async describeDestroy(_environment: Environment): Promise<EnvironmentResource[]> {
		return [];
	}

	async destroy(_environment: Environment): Promise<SecretsDestroyResult> {
		return {
			kind: 'success',
			resources: [],
		};
	}
}
