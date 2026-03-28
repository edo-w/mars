import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KvService } from '#src/cli/app/kv/kv-service';
import { vlogManager } from '#src/lib/vlogger';

export class KvGetCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		key_path: z.string().min(1),
		raw: z.boolean(),
	});

	env: string | null;
	key_path: string;
	raw: boolean;

	constructor(fields: unknown) {
		const parsed = KvGetCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.key_path = parsed.key_path;
		this.raw = parsed.raw;
	}
}

export function createKvGetCommand(container: Tiny): Command {
	const command = new Command('get');

	command.description('Get a kv value.');
	command.argument('<key_path>');
	command.option('--env <env>');
	command.option('--raw');
	command.action(async (keyPath, options) => {
		const fields = {
			env: options.env ?? null,
			key_path: keyPath,
			raw: options.raw === true,
		};
		const scope = container.createScope();

		await handleKvGetCommand(fields, scope);
	});

	return command;
}

export async function handleKvGetCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'kv', 'get']);
	let input: KvGetCommandInput;

	try {
		input = new KvGetCommandInput(fields);
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
		const result = await kvService.get(environment, input.key_path);

		if (result === null) {
			logger.error(`kv key "${input.key_path}" not found`);
			return;
		}

		if (input.raw) {
			process.stdout.write(Buffer.from(result.data));
			return;
		}

		process.stdout.write(new TextDecoder().decode(result.data));
		process.stdout.write('\n');
	} finally {
		await kvService.close();
	}
}
