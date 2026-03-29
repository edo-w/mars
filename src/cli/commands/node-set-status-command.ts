import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeStatus } from '#src/app/node/node-models';
import { NodeService } from '#src/app/node/node-service';
import { parseNodeReference } from '#src/app/node/node-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class NodeSetStatusCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		id: z.string().min(1),
		status: z.enum(NodeStatus),
	});

	env: string | null;
	id: string;
	status: NodeStatus;

	constructor(fields: unknown) {
		const parsed = NodeSetStatusCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.id = parsed.id;
		this.status = parsed.status;
	}
}

export function createNodeSetStatusCommand(container: Tiny): Command {
	const command = new Command('set-status');

	command.description('Set the node status.');
	command.argument('<id>');
	command.argument('<status>');
	command.option('--env <env>');
	command.action(async (id, status, options) => {
		const fields = {
			env: options.env ?? null,
			id,
			status,
		};
		const scope = container.createScope();

		await handleNodeSetStatusCommand(fields, scope);
	});

	return command;
}

export async function handleNodeSetStatusCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'set-status']);
	let input: NodeSetStatusCommandInput;

	try {
		input = new NodeSetStatusCommandInput(fields);
	} catch {
		logger.error('invalid node status input');
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
		const node = await nodeService.setStatus(environment, nodeId, input.status);

		if (node === null) {
			logger.error(`node "${nodeId}" not found`);
			return;
		}

		logger.info(`set node "${nodeId}" status to "${node.status}"`);
	} catch (error) {
		logger.error(String(error));
	} finally {
		await nodeService.close();
	}
}
