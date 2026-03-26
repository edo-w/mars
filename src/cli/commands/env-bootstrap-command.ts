import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import type { BackendBootstrapResult } from '#src/cli/app/backend/backend-bootstrapper';
import { BackendBootstrapperFactory } from '#src/cli/app/backend/backend-bootstrapper-factory';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import type { SecretsBootstrapResult } from '#src/cli/app/secrets/secrets-bootstrapper';
import { SecretsBootstrapperFactory } from '#src/cli/app/secrets/secrets-bootstrapper-factory';
import type { VLogger } from '#src/lib/vlogger';
import { vlogManager } from '#src/lib/vlogger';

export class EnvBootstrapCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
	});

	env: string | null;

	constructor(fields: unknown) {
		const parsed = EnvBootstrapCommandInput.schema.parse(fields);

		this.env = parsed.env;
	}
}

export function createEnvBootstrapCommand(container: Tiny): Command {
	const command = new Command('bootstrap');

	command.description('Bootstrap the Mars environment backend and secrets.');
	command.option('--env <env>');
	command.action(async (options) => {
		const fields = {
			env: options.env ?? null,
		};
		const scope = container.createScope();

		await handleEnvBootstrapCommand(fields, scope);
	});

	return command;
}

export async function handleEnvBootstrapCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'env', 'bootstrap']);
	let input: EnvBootstrapCommandInput;

	try {
		input = new EnvBootstrapCommandInput(fields);
	} catch {
		logger.error('invalid environment name');
		return;
	}

	const environmentService = container.get(EnvironmentService);
	const environment = await environmentService.resolveEnvironment(input.env);

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
	const backendResult = await backendBootstrapper.bootstrap(environment);

	logBootstrapResult(backendResult, logger);

	const secretsBootstrapperFactory = container.get(SecretsBootstrapperFactory);
	const secretsBootstrapper = await secretsBootstrapperFactory.create();
	const secretsResult = await secretsBootstrapper.bootstrap(environment);

	logBootstrapResult(secretsResult, logger);
}

function logBootstrapResult(result: BackendBootstrapResult | SecretsBootstrapResult, logger: VLogger): void {
	if (result.kind === 'noop') {
		return;
	}

	if (result.kind === 'already_exists') {
		logger.info(`${result.resource_label} already exists`);
		return;
	}

	logger.info(`created ${result.resource_label}`);
}
