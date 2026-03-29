import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import { vlogManager } from '#src/lib/vlogger';

export class NodeStateClearCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
	});

	env: string | null;

	constructor(fields: unknown) {
		const parsed = NodeStateClearCommandInput.schema.parse(fields);

		this.env = parsed.env;
	}
}

export function createNodeStateClearCommand(container: Tiny): Command {
	const command = new Command('clear');

	command.description('Clear local node state.');
	command.option('--env <env>');
	command.action(async (options) => {
		const fields = {
			env: options.env ?? null,
		};
		const scope = container.createScope();

		await handleNodeStateClearCommand(fields, scope);
	});

	return command;
}

export async function handleNodeStateClearCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'state', 'clear']);
	const input = new NodeStateClearCommandInput(fields);
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

	const nodeService = container.get(NodeService);

	try {
		await nodeService.stateClear(environment);
		logger.info(`cleared node state for "${environment.id}"`);
	} finally {
		await nodeService.close();
	}
}
