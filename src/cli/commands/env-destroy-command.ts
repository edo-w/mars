import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { BackendBootstrapperFactory } from '#src/cli/app/backend/backend-bootstrapper-factory';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import type { EnvironmentResource } from '#src/cli/app/environment/environment-shapes';
import { SecretsBootstrapperFactory } from '#src/cli/app/secrets/secrets-bootstrapper-factory';
import { Tui } from '#src/lib/tui';
import { vlogManager } from '#src/lib/vlogger';

export class EnvDestroyCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
	});

	env: string | null;

	constructor(fields: unknown) {
		const parsed = EnvDestroyCommandInput.schema.parse(fields);

		this.env = parsed.env;
	}
}

export function createEnvDestroyCommand(container: Tiny): Command {
	const command = new Command('destroy');

	command.description('Destroy Mars-managed environment resources.');
	command.option('--env <env>');
	command.action(async (options) => {
		const fields = {
			env: options.env ?? null,
		};
		const scope = container.createScope();

		await handleEnvDestroyCommand(fields, scope);
	});

	return command;
}

export async function handleEnvDestroyCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'env', 'destroy']);
	let input: EnvDestroyCommandInput;

	try {
		input = new EnvDestroyCommandInput(fields);
	} catch {
		logger.error('invalid environment name');
		return;
	}

	const service = container.get(EnvironmentService);
	const environment = await service.resolveEnvironment(input.env);

	if (environment === null) {
		if (input.env === null) {
			logger.error('no environment selected');
			return;
		}

		logger.error(`environment "${input.env}" does not exists`);
		return;
	}

	const backendBootstrapperFactory = container.get(BackendBootstrapperFactory);
	const backendBootstrapper = await backendBootstrapperFactory.create();
	const backendResources = await backendBootstrapper.describeDestroy(environment);
	const secretsBootstrapperFactory = container.get(SecretsBootstrapperFactory);
	const secretsBootstrapper = await secretsBootstrapperFactory.create();
	const secretsResources = await secretsBootstrapper.describeDestroy(environment);
	const resources = [...backendResources, ...secretsResources];

	logger.warning(
		`you are about to delete the environment "${environment.id}"\n\nthe following resources will be destroyed`,
	);

	for (const resource of resources) {
		logger.info(`- ${resource.label}`);
	}

	const tui = container.get(Tui);
	const confirmation = await tui.input('\nto confirm please enter the environment name');

	if (confirmation !== environment.id) {
		logger.error('invalid environment id');
		return;
	}

	for (const resource of resources) {
		logger.info(`remove ${resource.label}`);
	}

	const destroyedResources: EnvironmentResource[] = [];
	const backendResult = await backendBootstrapper.destroy(environment);

	destroyedResources.push(...backendResult.resources);

	if (backendResult.kind === 'fail') {
		logger.error('failed to destroy environment');
		logger.error(String(backendResult.error));
		return;
	}

	const secretsResult = await secretsBootstrapper.destroy(environment);

	destroyedResources.push(...secretsResult.resources);

	if (secretsResult.kind === 'fail') {
		logger.error('failed to destroy environment');
		logger.error(String(secretsResult.error));
		return;
	}

	for (const resource of destroyedResources) {
		if (resource.status === 'not_found') {
			logger.info(`${resource.label} not found`);
		}
	}

	logger.info(`environment "${environment.id}" destroyed successfully`);
}
