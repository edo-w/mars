import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';

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

	command.description('Bootstrap the Mars environment bucket.');
	command.option('--env <env>');
	command.action(async (options) => {
		await handleEnvBootstrapCommand({ env: options.env ?? null }, container.createScope());
	});

	return command;
}

export async function handleEnvBootstrapCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'env', 'bootstrap']);
	let input: EnvBootstrapCommandInput;

	try {
		input = new EnvBootstrapCommandInput(fields);
	} catch {
		logger.error('invalid environment name');
		return;
	}

	const service = container.get(EnvironmentService);
	const result = await service.bootstrap(input.env);

	switch (result.kind) {
		case 'already_exists': {
			logger.info(`s3 bucket "${result.bucket}" already exists`);
			return;
		}

		case 'created': {
			logger.info(`created s3 bucket "${result.bucket}"`);
			return;
		}

		case 'not_found': {
			logger.error(`environment "${result.name}" does not exists`);
			return;
		}

		case 'not_selected': {
			logger.error('no environment selected');
		}
	}
}
