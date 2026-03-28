import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KvService } from '#src/cli/app/kv/kv-service';
import { vlogManager } from '#src/lib/vlogger';

export class KvShowCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		key_path: z.string().min(1),
	});

	env: string | null;
	key_path: string;

	constructor(fields: unknown) {
		const parsed = KvShowCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.key_path = parsed.key_path;
	}
}

export function createKvShowCommand(container: Tiny): Command {
	const command = new Command('show');

	command.description('Show kv metadata.');
	command.argument('<key_path>');
	command.option('--env <env>');
	command.action(async (keyPath, options) => {
		const fields = {
			env: options.env ?? null,
			key_path: keyPath,
		};
		const scope = container.createScope();

		await handleKvShowCommand(fields, scope);
	});

	return command;
}

export async function handleKvShowCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'kv', 'show']);
	let input: KvShowCommandInput;

	try {
		input = new KvShowCommandInput(fields);
	} catch {
		logger.error('invalid kv key path');
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
		const result = await kvService.show(environment, input.key_path);

		if (result === null) {
			logger.error(`kv key "${input.key_path}" not found`);
			return;
		}

		logger.info(`key: ${result.key_path}`);
		logger.info(`version_id: ${result.version_id}`);
		logger.info(`type: ${result.type}`);
		logger.info(`size: ${result.size}`);
		logger.info(`secret: ${result.secret ? 'yes' : 'no'}`);
		logger.info(`create_date: ${result.create_date}`);
		logger.info(`update_date: ${result.update_date}`);
	} finally {
		await kvService.close();
	}
}
