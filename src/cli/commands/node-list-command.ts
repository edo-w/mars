import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import { readNodeListTags } from '#src/app/node/node-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class NodeListCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		tag: z.string().min(1).nullable(),
	});

	env: string | null;
	tag: string | null;

	constructor(fields: unknown) {
		const parsed = NodeListCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.tag = parsed.tag;
	}
}

export function createNodeListCommand(container: Tiny): Command {
	const command = new Command('list');

	command.description('List node records.');
	command.option('--env <env>');
	command.option('--tag <tags>');
	command.action(async (options) => {
		const fields = {
			env: options.env ?? null,
			tag: options.tag ?? null,
		};
		const scope = container.createScope();

		await handleNodeListCommand(fields, scope);
	});

	return command;
}

export async function handleNodeListCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'list']);
	let input: NodeListCommandInput;

	try {
		input = new NodeListCommandInput(fields);
	} catch {
		logger.error('invalid node list input');
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
	const tags = readNodeListTags(input.tag);

	try {
		const result = await nodeService.list(environment, tags);

		if (result.length === 0) {
			logger.info('no nodes found');
			return;
		}

		const rows = [
			['id', 'hostname', 'public_ip', 'private_ip', 'status', 'tags'],
			...result.map((item) => [
				item.id,
				item.hostname ?? '',
				item.public_ip,
				item.private_ip ?? '',
				item.status,
				item.tags.join(','),
			]),
		];
		const headerRow = rows[0];

		if (headerRow === undefined) {
			return;
		}

		const widths = headerRow.map((_, index) => {
			return Math.max(...rows.map((row) => row[index]?.length ?? 0));
		});

		for (const row of rows) {
			const line = row.map((value, index) => value.padEnd(widths[index] ?? value.length)).join('  ');

			logger.info(line);
		}
	} catch (error) {
		logger.error(String(error));
	} finally {
		await nodeService.close();
	}
}
