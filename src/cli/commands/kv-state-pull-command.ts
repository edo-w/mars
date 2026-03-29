import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { KvService } from '#src/app/kv/kv-service';
import { vlogManager } from '#src/lib/vlogger';

export class KvStatePullCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
	});

	env: string | null;

	constructor(fields: unknown) {
		const parsed = KvStatePullCommandInput.schema.parse(fields);

		this.env = parsed.env;
	}
}

export function createKvStatePullCommand(container: Tiny): Command {
	const command = new Command('pull');

	command.description('Pull kv state from the backend.');
	command.option('--env <env>');
	command.action(async (options) => {
		const fields = {
			env: options.env ?? null,
		};
		const scope = container.createScope();

		await handleKvStatePullCommand(fields, scope);
	});

	return command;
}

export async function handleKvStatePullCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'kv', 'state', 'pull']);
	let input: KvStatePullCommandInput;

	try {
		input = new KvStatePullCommandInput(fields);
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

		logger.error(`environment "${input.env}" not found`);
		return;
	}

	const kvService = container.get(KvService);
	try {
		await kvService.statePull(environment);

		logger.info('pulled kv state');
	} finally {
		await kvService.close();
	}
}
