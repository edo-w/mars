import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { BackendFactory } from '#src/cli/app/backend/backend-factory';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SecretsProviderFactory } from '#src/cli/app/secrets/secrets-provider-factory';
import { vlogManager } from '#src/lib/vlogger';

export class EnvShowCommandInput {
	static schema = z.object({
		name: z.string().min(1).nullable(),
	});

	name: string | null;

	constructor(fields: unknown) {
		const parsed = EnvShowCommandInput.schema.parse(fields);

		this.name = parsed.name;
	}
}

export function createEnvShowCommand(container: Tiny): Command {
	const command = new Command('show');

	command.description('Show environment details.');
	command.argument('[name]');
	command.action(async (name) => {
		const fields = {
			name: name ?? null,
		};
		const scope = container.createScope();

		await handleEnvShowCommand(fields, scope);
	});

	return command;
}

export async function handleEnvShowCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'env', 'show']);
	let input: EnvShowCommandInput;

	try {
		input = new EnvShowCommandInput(fields);
	} catch {
		logger.error('invalid environment name');
		return;
	}

	const service = container.get(EnvironmentService);
	const environment = input.name === null ? await service.getCurrent() : await service.get(input.name);

	if (environment === null) {
		if (input.name === null) {
			logger.warn('no environment selected');
			return;
		}

		logger.error(`environment "${input.name}" not found`);
		return;
	}

	const backendFactory = container.get(BackendFactory);
	const backendService = await backendFactory.create();
	const backendInfo = await backendService.getInfo(environment);
	const secretsProviderFactory = container.get(SecretsProviderFactory);
	const secretsProvider = await secretsProviderFactory.create();
	const secretsInfo = await secretsProvider.getInfo(environment);

	logger.info(`path: ./${environment.directoryPath}`);
	logger.info(`name: ${environment.config.name}`);
	logger.info(`namespace: ${environment.config.namespace}`);
	logger.info(`aws_account_id: ${environment.config.aws_account_id}`);
	logger.info(`aws_region: ${environment.config.aws_region}`);
	logger.info('backend:');
	logger.info(`type: ${backendInfo.type}`);

	for (const field of backendInfo.fields) {
		logger.info(`${field.name}: ${field.value}`);
	}

	logger.info('secrets:');
	logger.info(`type: ${secretsInfo.type}`);

	for (const field of secretsInfo.fields) {
		logger.info(`${field.name}: ${field.value}`);
	}
}
