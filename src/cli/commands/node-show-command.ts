import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import { parseNodeReference } from '#src/cli/app/node/node-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class NodeShowCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		id: z.string().min(1),
	});

	env: string | null;
	id: string;

	constructor(fields: unknown) {
		const parsed = NodeShowCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.id = parsed.id;
	}
}

export function createNodeShowCommand(container: Tiny): Command {
	const command = new Command('show');

	command.description('Show a node record.');
	command.argument('<id>');
	command.option('--env <env>');
	command.action(async (id, options) => {
		const fields = {
			env: options.env ?? null,
			id,
		};
		const scope = container.createScope();

		await handleNodeShowCommand(fields, scope);
	});

	return command;
}

export async function handleNodeShowCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'show']);
	let input: NodeShowCommandInput;

	try {
		input = new NodeShowCommandInput(fields);
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
		const result = await nodeService.get(environment, nodeId);

		if (result === null) {
			logger.error(`node "${nodeId}" not found`);
			return;
		}

		logger.info(`id: ${result.node.id}`);
		logger.info(`hostname: ${result.node.hostname ?? 'null'}`);
		logger.info(`public_ip: ${result.node.public_ip}`);
		logger.info(`private_ip: ${result.node.private_ip ?? 'null'}`);
		logger.info(`status: ${result.node.status}`);
		logger.info(`create_date: ${result.node.create_date}`);
		logger.info(`update_date: ${result.node.update_date}`);
		logger.info(`tags: [${result.tags.join(', ')}]`);
		logger.info('properties:');

		const propertyEntries = Object.entries(result.node.properties).sort(([leftKey], [rightKey]) => {
			return leftKey.localeCompare(rightKey);
		});

		for (const [propertyKey, propertyValue] of propertyEntries) {
			logger.info(`${propertyKey}: ${String(propertyValue)}`);
		}
	} catch (error) {
		logger.error(String(error));
	} finally {
		await nodeService.close();
	}
}
