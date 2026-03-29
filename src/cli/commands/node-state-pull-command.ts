import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import { vlogManager } from '#src/lib/vlogger';

export class NodeStatePullCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
	});

	env: string | null;

	constructor(fields: unknown) {
		const parsed = NodeStatePullCommandInput.schema.parse(fields);

		this.env = parsed.env;
	}
}

export function createNodeStatePullCommand(container: Tiny): Command {
	const command = new Command('pull');

	command.description('Pull node state from the backend.');
	command.option('--env <env>');
	command.action(async (options) => {
		const fields = {
			env: options.env ?? null,
		};
		const scope = container.createScope();

		await handleNodeStatePullCommand(fields, scope);
	});

	return command;
}

export async function handleNodeStatePullCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'state', 'pull']);
	const input = new NodeStatePullCommandInput(fields);
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
		await nodeService.statePull(environment);
		logger.info(`pulled node state for "${environment.id}"`);
	} finally {
		await nodeService.close();
	}
}
