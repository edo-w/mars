import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import { vlogManager } from '#src/lib/vlogger';

export class NodeStateSaveCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
	});

	env: string | null;

	constructor(fields: unknown) {
		const parsed = NodeStateSaveCommandInput.schema.parse(fields);

		this.env = parsed.env;
	}
}

export function createNodeStateSaveCommand(container: Tiny): Command {
	const command = new Command('save');

	command.description('Save node state to the backend.');
	command.option('--env <env>');
	command.action(async (options) => {
		const fields = {
			env: options.env ?? null,
		};
		const scope = container.createScope();

		await handleNodeStateSaveCommand(fields, scope);
	});

	return command;
}

export async function handleNodeStateSaveCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'state', 'save']);
	const input = new NodeStateSaveCommandInput(fields);
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
		const result = await nodeService.stateSave(environment);

		logger.info(`saved node state (${result.node_count} nodes)`);
	} finally {
		await nodeService.close();
	}
}
