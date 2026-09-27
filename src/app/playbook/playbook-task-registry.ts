import type { PlaybookTaskHandlerClass } from '#src/app/playbook/playbook-task-handler';

export class PlaybookTaskRegistry {
	handlers: Map<string, PlaybookTaskHandlerClass>;

	constructor() {
		this.handlers = new Map();
	}

	get(taskType: string): PlaybookTaskHandlerClass | null {
		return this.handlers.get(taskType) ?? null;
	}

	register(taskType: string, handlerClass: PlaybookTaskHandlerClass): void {
		if (this.handlers.has(taskType)) {
			throw new Error(`playbook task handler "${taskType}" already registered`);
		}

		this.handlers.set(taskType, handlerClass);
	}
}
