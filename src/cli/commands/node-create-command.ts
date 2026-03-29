import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import { parseNodeCreateValue } from '#src/app/node/node-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class NodeCreateCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		public_ip_or_id: z.string().min(1),
	});

	env: string | null;
	public_ip_or_id: string;

	constructor(fields: unknown) {
		const parsed = NodeCreateCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.public_ip_or_id = parsed.public_ip_or_id;
	}
}

export function createNodeCreateCommand(container: Tiny): Command {
	const command = new Command('create');

	command.description('Create a node record.');
	command.argument('<public_ip_or_id>');
	command.option('--env <env>');
	command.action(async (publicIpOrId, options) => {
		const fields = {
			env: options.env ?? null,
			public_ip_or_id: publicIpOrId,
		};
		const scope = container.createScope();

		await handleNodeCreateCommand(fields, scope);
	});

	return command;
}

export async function handleNodeCreateCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'create']);
	let input: NodeCreateCommandInput;

	try {
		input = new NodeCreateCommandInput(fields);
	} catch {
		logger.error('invalid node create input');
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
		const createInput = parseNodeCreateValue(input.public_ip_or_id);
		const node = await nodeService.create(environment, createInput);

		logger.info(`created node "${node.id}"`);
	} catch (error) {
		logger.error(String(error));
	} finally {
		await nodeService.close();
	}
}
