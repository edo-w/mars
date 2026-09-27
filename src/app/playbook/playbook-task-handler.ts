import type { PlaybookTaskContext, PlaybookTaskResultModel } from '#src/app/playbook/playbook-models';

export interface PlaybookTaskHandler {
	run(context: PlaybookTaskContext, input: Record<string, unknown>): Promise<PlaybookTaskResultModel>;
}

export interface PlaybookTaskHandlerClass {
	new (...args: unknown[]): PlaybookTaskHandler;
}
