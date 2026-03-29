import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import { parseNodeReference } from '#src/app/node/node-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class NodeEventListCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		id: z.string().min(1).nullable(),
	});

	env: string | null;
	id: string | null;

	constructor(fields: unknown) {
		const parsed = NodeEventListCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.id = parsed.id;
	}
}

export function createNodeEventListCommand(container: Tiny): Command {
	const command = new Command('list');

	command.description('List node events.');
	command.argument('[id]');
	command.option('--env <env>');
	command.action(async (id, options) => {
		const fields = {
			env: options.env ?? null,
			id: id ?? null,
		};
		const scope = container.createScope();

		await handleNodeEventListCommand(fields, scope);
	});

	return command;
}

export async function handleNodeEventListCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'node', 'event', 'list']);
	let input: NodeEventListCommandInput;

	try {
		input = new NodeEventListCommandInput(fields);
	} catch {
		logger.error('invalid node event list input');
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
		const nodeId = input.id === null ? null : parseNodeReference(input.id);
		const result = await nodeService.listEvents(environment, nodeId);

		if (result.length === 0) {
			logger.info('no node events found');
			return;
		}

		const rows = [
			['id', 'action', 'date', 'context'],
			...result.map((item) => {
				return [item.node_id, item.action, item.date, formatNodeEventContext(item.context)];
			}),
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

function formatNodeEventContext(context: Record<string, unknown>): string {
	const contextEntries = Object.entries(context).sort(([leftKey], [rightKey]) => {
		return leftKey.localeCompare(rightKey);
	});

	if (contextEntries.length === 0) {
		return '';
	}

	return contextEntries
		.map(([key, value]) => {
			return `${key}=${formatNodeEventContextValue(value)}`;
		})
		.join('; ');
}

function formatNodeEventContextValue(value: unknown): string {
	if (Array.isArray(value)) {
		return value.map((item) => formatNodeEventContextValue(item)).join(',');
	}

	if (value !== null && typeof value === 'object') {
		const objectEntries = Object.entries(value).sort(([leftKey], [rightKey]) => {
			return leftKey.localeCompare(rightKey);
		});

		return objectEntries
			.map(([key, currentValue]) => {
				return `${key}:${formatNodeEventContextValue(currentValue)}`;
			})
			.join(',');
	}

	return String(value);
}
