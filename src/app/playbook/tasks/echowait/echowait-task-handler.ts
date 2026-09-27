import {
	type PlaybookTaskContext,
	type PlaybookTaskResultModel,
	PlaybookTaskResultModel as PlaybookTaskResultRecord,
	PlaybookTaskStatus,
} from '#src/app/playbook/playbook-models';
import type { PlaybookTaskHandler } from '#src/app/playbook/playbook-task-handler';
import { EchowaitTaskInput } from '#src/app/playbook/tasks/echowait/echowait-task';

export class EchowaitTaskHandler implements PlaybookTaskHandler {
	async run(context: PlaybookTaskContext, input: Record<string, unknown>): Promise<PlaybookTaskResultModel> {
		const taskInput = new EchowaitTaskInput(input);
		let stderr = '';
		let stdout = '';
		const total = taskInput.steps.length;

		for (const [index, [message, waitSeconds]] of taskInput.steps.entries()) {
			context.emitProgress({
				message,
				percent: Math.round(((index + 1) / total) * 100),
				step: index + 1,
				total,
			});

			const result = await context.ssh.exec(createEchowaitCommand(message, waitSeconds));

			stdout += result.stdout;
			stderr += result.stderr;

			if (result.code !== 0) {
				return new PlaybookTaskResultRecord({
					message: `echowait step failed: ${message}`,
					ok: false,
					output: {
						step: index + 1,
						total,
					},
					status: PlaybookTaskStatus.Fail,
					stderr,
					stdout,
				});
			}
		}

		return new PlaybookTaskResultRecord({
			message: `completed ${total} echowait step(s)`,
			ok: true,
			output: {
				step_total: total,
			},
			status: PlaybookTaskStatus.Ok,
			stderr,
			stdout,
		});
	}
}

function createEchowaitCommand(message: string, waitSeconds: number): string {
	const quotedMessage = shellQuote(message);

	return `printf '%s\\n' ${quotedMessage} && sleep ${waitSeconds}`;
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", "'\"'\"'")}'`;
}
