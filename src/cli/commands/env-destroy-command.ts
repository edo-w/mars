import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import Enquirer from 'enquirer';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';

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
		await handleEnvDestroyCommand({ env: options.env ?? null }, container.createScope());
	});

	return command;
}

export async function handleEnvDestroyCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'env', 'destroy']);
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

	const resources = await service.describeDestroy(environment);

	logger.warning(
		`you are about to delete the environment "${environment.id}"\n\nthe following resources will be destroyed`,
	);

	for (const resource of resources) {
		logger.info(`- ${resource.label}`);
	}

	const confirmation = await promptForDestroyConfirmation();

	if (confirmation !== environment.id) {
		logger.error('invalid environment id');
		return;
	}

	for (const resource of resources) {
		logger.info(`remove ${resource.label}`);
	}

	const result = await service.destroy(input.env);

	switch (result.kind) {
		case 'success': {
			for (const resource of result.resources) {
				if (resource.status === 'not_found') {
					logger.info(`${resource.label} not found`);
				}
			}

			logger.info(`environment "${result.environment.id}" destroyed successfully`);
			return;
		}

		case 'fail': {
			logger.error('failed to destroy environment');
			logger.error(String(result.error));
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

async function promptForDestroyConfirmation(): Promise<string | null> {
	try {
		const result = await Enquirer.prompt<{ confirmation: string }>({
			message: '\nto confirm please enter the environment name',
			name: 'confirmation',
			type: 'input',
		});

		return result.confirmation;
	} catch {
		return null;
	}
}
