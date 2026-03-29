import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { Tui } from '#src/lib/tui';
import { vlogManager } from '#src/lib/vlogger';

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
	const logger = vlogManager.getLogger(['mars', 'env', 'select']);
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
		const tui = container.get(Tui);
		const environments = await service.list();

		if (environments.length === 0) {
			logger.warn('no environments found');
			return;
		}

		environmentName = await tui.autocomplete(
			'Select environment',
			environments.map((environment) => environment.id),
		);

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
