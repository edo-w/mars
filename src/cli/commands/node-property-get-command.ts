import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import { formatNodePropertyValue, parseNodePropertyKey, parseNodeReference } from '#src/app/node/node-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class NodePropertyGetCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		id: z.string().min(1),
		property: z.string().min(1),
	});

	env: string | null;
	id: string;
	property: string;

	constructor(fields: unknown) {
		const parsed = NodePropertyGetCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.id = parsed.id;
		this.property = parsed.property;
	}
}

export function createNodePropertyGetCommand(container: Tiny): Command {
	const command = new Command('get');

	command.description('Get a node property.');
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

		await handleNodePropertyGetCommand(fields, scope);
	});

	return command;
}

export async function handleNodePropertyGetCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'property', 'get']);
	let input: NodePropertyGetCommandInput;

	try {
		input = new NodePropertyGetCommandInput(fields);
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
		const result = await nodeService.getProperty(environment, nodeId, propertyKey);

		if (result.kind === 'node_not_found') {
			logger.error(`node "${nodeId}" not found`);
			return;
		}

		if (result.kind === 'property_not_found') {
			logger.error(`property "${propertyKey}" not found`);
			return;
		}

		logger.info(formatNodePropertyValue(result.value));
	} catch (error) {
		logger.error(String(error));
	} finally {
		await nodeService.close();
	}
}
