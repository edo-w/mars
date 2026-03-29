import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { KvService } from '#src/app/kv/kv-service';
import { vlogManager } from '#src/lib/vlogger';

export class KvRemoveCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		key_path: z.string().min(1),
	});

	env: string | null;
	key_path: string;

	constructor(fields: unknown) {
		const parsed = KvRemoveCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.key_path = parsed.key_path;
	}
}

export function createKvRemoveCommand(container: Tiny): Command {
	const command = new Command('remove');

	command.alias('rm');
	command.description('Remove a kv value.');
	command.argument('<key_path>');
	command.option('--env <env>');
	command.action(async (keyPath, options) => {
		const fields = {
			env: options.env ?? null,
			key_path: keyPath,
		};
		const scope = container.createScope();

		await handleKvRemoveCommand(fields, scope);
	});

	return command;
}

export async function handleKvRemoveCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'kv', 'remove']);
	let input: KvRemoveCommandInput;

	try {
		input = new KvRemoveCommandInput(fields);
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
		const removed = await kvService.remove(environment, input.key_path);

		if (!removed) {
			logger.error(`kv key "${input.key_path}" not found`);
			return;
		}

		logger.info(`removed kv "${input.key_path}"`);
	} finally {
		await kvService.close();
	}
}
