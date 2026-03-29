import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import { parseNodeReference } from '#src/cli/app/node/node-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class NodeRemoveCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		id: z.string().min(1),
	});

	env: string | null;
	id: string;

	constructor(fields: unknown) {
		const parsed = NodeRemoveCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.id = parsed.id;
	}
}

export function createNodeRemoveCommand(container: Tiny): Command {
	const command = new Command('remove');

	command.alias('rm');
	command.description('Remove a node record.');
	command.argument('<id>');
	command.option('--env <env>');
	command.action(async (id, options) => {
		const fields = {
			env: options.env ?? null,
			id,
		};
		const scope = container.createScope();

		await handleNodeRemoveCommand(fields, scope);
	});

	return command;
}

export async function handleNodeRemoveCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'remove']);
	let input: NodeRemoveCommandInput;

	try {
		input = new NodeRemoveCommandInput(fields);
	} catch {
		logger.error('invalid node id');
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

	const nodeService = container.get(NodeService);

	try {
		const nodeId = parseNodeReference(input.id);
		const removed = await nodeService.remove(environment, nodeId);

		if (!removed) {
			logger.error(`node "${nodeId}" not found`);
			return;
		}

		logger.info(`removed node "${nodeId}"`);
	} catch (error) {
		logger.error(String(error));
	} finally {
		await nodeService.close();
	}
}
