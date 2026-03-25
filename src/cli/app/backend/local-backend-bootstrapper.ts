import type { BackendBootstrapper, BackendBootstrapResult } from '#src/cli/app/backend/backend-bootstrapper';
import type { BackendDestroyResult } from '#src/cli/app/backend/backend-shapes';
import type { Environment, EnvironmentResource } from '#src/cli/app/environment/environment-shapes';

export class LocalBackendBootstrapper implements BackendBootstrapper {
	async bootstrap(_environment: Environment): Promise<BackendBootstrapResult> {
		return {
			kind: 'noop',
		};
	}

	async describeDestroy(_environment: Environment): Promise<EnvironmentResource[]> {
		return [];
	}

	async destroy(_environment: Environment): Promise<BackendDestroyResult> {
		return {
			kind: 'success',
			resources: [],
		};
	}
}
