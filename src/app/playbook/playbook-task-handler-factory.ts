import type { Tiny } from '@edo-w/tiny';
import type { PlaybookTaskHandler } from '#src/app/playbook/playbook-task-handler';
import type { PlaybookTaskRegistry } from '#src/app/playbook/playbook-task-registry';

export class PlaybookTaskHandlerFactory {
	container: Tiny;
	registry: PlaybookTaskRegistry;

	constructor(container: Tiny, registry: PlaybookTaskRegistry) {
		this.container = container;
		this.registry = registry;
	}

	create(taskType: string): PlaybookTaskHandler {
		const handlerClass = this.registry.get(taskType);

		if (handlerClass === null) {
			throw new Error(`playbook task handler "${taskType}" not found`);
		}

		return this.container.createScope().get(handlerClass);
	}
}
