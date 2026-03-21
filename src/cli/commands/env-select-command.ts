import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import Enquirer from 'enquirer';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';

export class EnvSelectCommandInput {
	static schema = z.object({
		name: z.string().min(1).nullable(),
	});

	name: string | null;

	constructor(fields: unknown) {
		const parsed = EnvSelectCommandInput.schema.parse(fields);

		this.name = parsed.name;
	}
}

export function createEnvSelectCommand(container: Tiny): Command {
	const command = new Command('select');

	command.description('Select the current environment.');
	command.argument('[name]');
	command.action(async (name) => {
		await handleEnvSelectCommand({ name: name ?? null }, container.createScope());
	});

	return command;
}

export async function handleEnvSelectCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'env', 'select']);
	let input: EnvSelectCommandInput;

	try {
		input = new EnvSelectCommandInput(fields);
	} catch {
		logger.error('invalid environment name');
		return;
	}

	const service = container.get(EnvironmentService);
	let environmentName = input.name;

	if (environmentName === null) {
		const environments = await service.list();

		if (environments.length === 0) {
			logger.warn('no environments found');
			return;
		}

		environmentName = await selectEnvironmentName(environments.map((environment) => environment.id));

		if (environmentName === null) {
			return;
		}
	}

	const environment = await service.select(environmentName);

	if (environment === null) {
		logger.error(`environment "${environmentName}" not found`);
		return;
	}

	logger.info(`selected "${environment.id}"`);
}

async function selectEnvironmentName(environmentNames: string[]): Promise<string | null> {
	try {
		const result = await Enquirer.prompt<{ environment: string }>({
			choices: environmentNames,
			message: 'Select environment',
			name: 'environment',
			type: 'autocomplete',
		});

		return result.environment;
	} catch {
		return null;
	}
}
