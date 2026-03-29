import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { KvService } from '#src/app/kv/kv-service';
import { vlogManager } from '#src/lib/vlogger';

export class KvStateClearCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
	});

	env: string | null;

	constructor(fields: unknown) {
		const parsed = KvStateClearCommandInput.schema.parse(fields);

		this.env = parsed.env;
	}
}

export function createKvStateClearCommand(container: Tiny): Command {
	const command = new Command('clear');

	command.description('Clear local kv state.');
	command.option('--env <env>');
	command.action(async (options) => {
		const fields = {
			env: options.env ?? null,
		};
		const scope = container.createScope();

		await handleKvStateClearCommand(fields, scope);
	});

	return command;
}

export async function handleKvStateClearCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'kv', 'state', 'clear']);
	let input: KvStateClearCommandInput;

	try {
		input = new KvStateClearCommandInput(fields);
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
		await kvService.stateClear(environment);

		logger.info('cleared kv state');
	} finally {
		await kvService.close();
	}
}
