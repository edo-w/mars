import type { Environment, EnvironmentResource } from '#src/app/environment/environment-shapes';

export interface SecretsBootstrapNoopResult {
	kind: 'noop';
}

export interface SecretsBootstrapAlreadyExistsResult {
	kind: 'already_exists';
	resource_label: string;
}

export interface SecretsBootstrapCreatedResult {
	kind: 'created';
	resource_label: string;
}

export type SecretsBootstrapResult =
	| SecretsBootstrapNoopResult
	| SecretsBootstrapAlreadyExistsResult
	| SecretsBootstrapCreatedResult;

export interface SecretsDestroySuccessResult {
	kind: 'success';
	resources: EnvironmentResource[];
}

export interface SecretsDestroyFailResult {
	error: unknown;
	kind: 'fail';
	resources: EnvironmentResource[];
}

export type SecretsDestroyResult = SecretsDestroySuccessResult | SecretsDestroyFailResult;

export interface SecretsBootstrapper {
	bootstrap(environment: Environment): Promise<SecretsBootstrapResult>;
	describeDestroy(environment: Environment): Promise<EnvironmentResource[]>;
	destroy(environment: Environment): Promise<SecretsDestroyResult>;
}
