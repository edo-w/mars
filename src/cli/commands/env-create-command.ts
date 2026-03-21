import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';

export class EnvCreateCommandInput {
	static schema = z.object({
		name: z.string().min(1),
	});

	name: string;

	constructor(fields: unknown) {
		const parsed = EnvCreateCommandInput.schema.parse(fields);

		this.name = parsed.name;
	}
}

export function createEnvCreateCommand(container: Tiny): Command {
	const command = new Command('create');

	command.description('Create an environment.');
	command.argument('<name>');
	command.action(async (name) => {
		await handleEnvCreateCommand({ name }, container.createScope());
	});

	return command;
}

export async function handleEnvCreateCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'env', 'create']);
	let input: EnvCreateCommandInput;

	try {
		input = new EnvCreateCommandInput(fields);
	} catch {
		logger.error('invalid environment name');
		return;
	}

	const service = container.get(EnvironmentService);
	const environment = await service.create(input.name);

	if (environment === null) {
		logger.warning(`environment "${input.name}" already exists`);
		return;
	}

	logger.info(`created environment "${environment.id}"`);
}
