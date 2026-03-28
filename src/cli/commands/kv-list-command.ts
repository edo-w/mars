import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KvService } from '#src/cli/app/kv/kv-service';
import { vlogManager } from '#src/lib/vlogger';

export class KvListCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		key_path: z.string().min(1).nullable(),
	});

	env: string | null;
	key_path: string | null;

	constructor(fields: unknown) {
		const parsed = KvListCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.key_path = parsed.key_path;
	}
}

export function createKvListCommand(container: Tiny): Command {
	const command = new Command('list');

	command.description('List kv values under a prefix.');
	command.argument('[key_path]');
	command.option('--env <env>');
	command.action(async (keyPath, options) => {
		const fields = {
			env: options.env ?? null,
			key_path: keyPath ?? null,
		};
		const scope = container.createScope();

		await handleKvListCommand(fields, scope);
	});

	return command;
}

export async function handleKvListCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'kv', 'list']);
	let input: KvListCommandInput;

	try {
		input = new KvListCommandInput(fields);
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
		const result = await kvService.list(environment, input.key_path ?? '/');

		if (result.length === 0) {
			logger.info('no kv keys found');
			return;
		}

		const rows = [
			['key', 'type', 'size', 'secret', 'date'],
			...result.map((item) => [item.key, item.type, String(item.size), item.secret ? 'yes' : 'no', item.date]),
		];
		const headerRow = rows[0];

		if (headerRow === undefined) {
			return;
		}

		const widths = headerRow.map((_, index) => {
			return Math.max(...rows.map((row) => row[index]?.length ?? 0));
		});

		for (const row of rows) {
			const line = row.map((value, index) => value.padEnd(widths[index] ?? value.length)).join('  ');

			logger.info(line);
		}
	} finally {
		await kvService.close();
	}
}
