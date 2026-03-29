import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import { parseNodePropertyKey, parseNodeReference } from '#src/cli/app/node/node-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class NodePropertyRemoveCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		id: z.string().min(1),
		property: z.string().min(1),
	});

	env: string | null;
	id: string;
	property: string;

	constructor(fields: unknown) {
		const parsed = NodePropertyRemoveCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.id = parsed.id;
		this.property = parsed.property;
	}
}

export function createNodePropertyRemoveCommand(container: Tiny): Command {
	const command = new Command('rm');

	command.description('Remove a node property.');
	command.argument('<id>');
	command.argument('<property>');
	command.option('--env <env>');
	command.action(async (id, property, options) => {
		const fields = {
			env: options.env ?? null,
			id,
			property,
		};
		const scope = container.createScope();

		await handleNodePropertyRemoveCommand(fields, scope);
	});

	return command;
}

export async function handleNodePropertyRemoveCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'property', 'rm']);
	let input: NodePropertyRemoveCommandInput;

	try {
		input = new NodePropertyRemoveCommandInput(fields);
	} catch {
		logger.error('invalid node property input');
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
		const propertyKey = parseNodePropertyKey(input.property);
		const result = await nodeService.removeProperty(environment, nodeId, propertyKey);

		if (result.kind === 'node_not_found') {
			logger.error(`node "${nodeId}" not found`);
			return;
		}

		if (result.kind === 'property_not_found') {
			logger.error(`property "${propertyKey}" not found`);
			return;
		}

		logger.info(`removed node "${nodeId}" property "${propertyKey}"`);
	} catch (error) {
		logger.error(String(error));
	} finally {
		await nodeService.close();
	}
}
