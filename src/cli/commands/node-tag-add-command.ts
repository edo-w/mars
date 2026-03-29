import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import { parseNodeReference } from '#src/app/node/node-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class NodeTagAddCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		id: z.string().min(1),
		tag: z.string().min(1),
	});

	env: string | null;
	id: string;
	tag: string;

	constructor(fields: unknown) {
		const parsed = NodeTagAddCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.id = parsed.id;
		this.tag = parsed.tag;
	}
}

export function createNodeTagAddCommand(container: Tiny): Command {
	const command = new Command('add');

	command.description('Add a tag to a node.');
	command.argument('<id>');
	command.argument('<tag>');
	command.option('--env <env>');
	command.action(async (id, tag, options) => {
		const fields = {
			env: options.env ?? null,
			id,
			tag,
		};
		const scope = container.createScope();

		await handleNodeTagAddCommand(fields, scope);
	});

	return command;
}

export async function handleNodeTagAddCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'tag', 'add']);
	let input: NodeTagAddCommandInput;

	try {
		input = new NodeTagAddCommandInput(fields);
	} catch {
		logger.error('invalid node tag input');
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
		const added = await nodeService.addTag(environment, nodeId, input.tag);

		if (!added) {
			logger.error(`node "${nodeId}" not found`);
			return;
		}

		logger.info(`added tag "${input.tag}" to node "${nodeId}"`);
	} catch (error) {
		logger.error(String(error));
	} finally {
		await nodeService.close();
	}
}
