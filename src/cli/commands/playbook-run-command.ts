import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { PlaybookService } from '#src/app/playbook/playbook-service';
import type { PlaybookEvent } from '#src/app/playbook/playbook-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class PlaybookRunCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		file: z.string().min(1),
	});

	env: string | null;
	file: string;

	constructor(fields: unknown) {
		const parsed = PlaybookRunCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.file = parsed.file;
	}
}

export function createPlaybookRunCommand(container: Tiny): Command {
	const command = new Command('run');

	command.argument('<file>');
	command.description('Run a Mars playbook.');
	command.option('--env <env>');
	command.action(async (file, options) => {
		const fields = {
			env: options.env ?? null,
			file,
		};
		const scope = container.createScope();

		await handlePlaybookRunCommand(fields, scope);
	});

	return command;
}

export async function handlePlaybookRunCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'playbook', 'run']);
	let input: PlaybookRunCommandInput;

	try {
		input = new PlaybookRunCommandInput(fields);
	} catch {
		logger.error('invalid playbook run input');
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

	const playbookService = container.get(PlaybookService);

	try {
		const playbookRun = await playbookService.run(environment, input.file);

		playbookRun.onEvent((event) => {
			logPlaybookEvent(logger, event);
		});

		const result = await playbookRun.result();

		if (result.fail_node_ids.length > 0) {
			logger.error(
				`playbook "${result.playbook_name}" finished with ${result.fail_node_ids.length} failed node(s)`,
			);
			return;
		}

		logger.info(`playbook "${result.playbook_name}" completed in ${result.duration}ms`);
	} catch (error) {
		logger.error(String(error));
	}
}

function logPlaybookEvent(logger: ReturnType<typeof vlogManager.getLogger>, event: PlaybookEvent): void {
	if (event.type === 'playbook.start') {
		logger.info(`playbook "${event.playbook_name}" started on ${event.node_ids.length} node(s)`);
		return;
	}

	if (event.type === 'playbook.end') {
		logger.info(
			`playbook "${event.playbook_name}" ended in ${event.duration}ms: ok=${event.ok_node_ids.length}, change=${event.change_node_ids.length}, fail=${event.fail_node_ids.length}, skip=${event.skip_node_ids.length}`,
		);
		return;
	}

	if (event.type === 'task.wave.start') {
		logger.info(
			`task ${event.step}/${event.total} "${event.task_name}" started on ${event.node_ids.length} node(s)`,
		);
		return;
	}

	if (event.type === 'task.wave.end') {
		logger.info(
			`task ${event.step}/${event.total} "${event.task_name}" finished: ok=${event.ok_node_ids.length}, change=${event.change_node_ids.length}, fail=${event.fail_node_ids.length}, skip=${event.skip_node_ids.length}`,
		);
		return;
	}

	if (event.type === 'task.node.start') {
		logger.info(`node "${event.node_id}" task "${event.task_name}" started`);
		return;
	}

	if (event.type === 'task.node.progress') {
		logger.info(`node "${event.node_id}" task "${event.task_name}" ${event.message ?? 'progress'}`);
		return;
	}

	logger.info(
		`node "${event.node_id}" task "${event.task_name}" ${event.status}${event.message === null ? '' : `: ${event.message}`}`,
	);
}
