import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';

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
		await handleEnvShowCommand({ name: name ?? null }, container.createScope());
	});

	return command;
}

export async function handleEnvShowCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'env', 'show']);
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

	const envBucket = await service.getBucketName(environment);

	logger.info(`path: ./${environment.directoryPath}`);
	logger.info(`name: ${environment.config.name}`);
	logger.info(`namespace: ${environment.config.namespace}`);
	logger.info(`aws_account_id: ${environment.config.aws_account_id}`);
	logger.info(`aws_region: ${environment.config.aws_region}`);
	logger.info(`env_bucket: ${envBucket}`);
}
