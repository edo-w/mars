import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import {
	formatNodePropertyValue,
	parseNodePropertyKey,
	parseNodePropertyValue,
	parseNodeReference,
} from '#src/cli/app/node/node-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class NodePropertySetCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		id: z.string().min(1),
		property: z.string().min(1),
		value: z.string(),
	});

	env: string | null;
	id: string;
	property: string;
	value: string;

	constructor(fields: unknown) {
		const parsed = NodePropertySetCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.id = parsed.id;
		this.property = parsed.property;
		this.value = parsed.value;
	}
}

export function createNodePropertySetCommand(container: Tiny): Command {
	const command = new Command('set');

	command.description('Set a node property.');
	command.argument('<id>');
	command.argument('<property>');
	command.argument('<value>');
	command.option('--env <env>');
	command.action(async (id, property, value, options) => {
		const fields = {
			env: options.env ?? null,
			id,
			property,
			value,
		};
		const scope = container.createScope();

		await handleNodePropertySetCommand(fields, scope);
	});

	return command;
}

export async function handleNodePropertySetCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'property', 'set']);
	let input: NodePropertySetCommandInput;

	try {
		input = new NodePropertySetCommandInput(fields);
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
		const propertyValue = parseNodePropertyValue(input.value);
		const value = await nodeService.setProperty(environment, nodeId, propertyKey, propertyValue);

		if (value === null) {
			logger.error(`node "${nodeId}" not found`);
			return;
		}

		logger.info(`set node "${nodeId}" property "${propertyKey}" to "${formatNodePropertyValue(value)}"`);
	} catch (error) {
		logger.error(String(error));
	} finally {
		await nodeService.close();
	}
}
