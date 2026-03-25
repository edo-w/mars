import type { BackendDestroyResult } from '#src/cli/app/backend/backend-shapes';
import type { Environment, EnvironmentResource } from '#src/cli/app/environment/environment-shapes';

export interface BackendBootstrapNoopResult {
	kind: 'noop';
}

export interface BackendBootstrapAlreadyExistsResult {
	kind: 'already_exists';
	resource_label: string;
}

export interface BackendBootstrapCreatedResult {
	kind: 'created';
	resource_label: string;
}

export type BackendBootstrapResult =
	| BackendBootstrapNoopResult
	| BackendBootstrapAlreadyExistsResult
	| BackendBootstrapCreatedResult;

export interface BackendBootstrapper {
	bootstrap(environment: Environment): Promise<BackendBootstrapResult>;
	describeDestroy(environment: Environment): Promise<EnvironmentResource[]>;
	destroy(environment: Environment): Promise<BackendDestroyResult>;
}
