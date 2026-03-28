import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KvService } from '#src/cli/app/kv/kv-service';
import { vlogManager } from '#src/lib/vlogger';

export class KvStateSaveCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
	});

	env: string | null;

	constructor(fields: unknown) {
		const parsed = KvStateSaveCommandInput.schema.parse(fields);

		this.env = parsed.env;
	}
}

export function createKvStateSaveCommand(container: Tiny): Command {
	const command = new Command('save');

	command.description('Save kv state to the backend.');
	command.option('--env <env>');
	command.action(async (options) => {
		const fields = {
			env: options.env ?? null,
		};
		const scope = container.createScope();

		await handleKvStateSaveCommand(fields, scope);
	});

	return command;
}

export async function handleKvStateSaveCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'kv', 'state', 'save']);
	let input: KvStateSaveCommandInput;

	try {
		input = new KvStateSaveCommandInput(fields);
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
		const result = await kvService.stateSave(environment);

		logger.info(`saved kv state (${result.uploaded_blob_count} uploads, ${result.deleted_blob_count} deletes)`);
	} finally {
		await kvService.close();
	}
}
