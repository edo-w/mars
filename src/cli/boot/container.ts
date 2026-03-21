import { Tiny } from '@edo-w/tiny';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { InitService } from '#src/cli/app/init/init-service';
import { StateService } from '#src/cli/app/state/state-service';
import { Vfs } from '#src/lib/vfs';

export interface CreateContainerOptions {
	cwd: string;
}

export function createContainer(options: CreateContainerOptions): Tiny {
	const container = new Tiny();

	container.addSingletonFactory(Vfs, () => {
		return new Vfs(options.cwd);
	});
	container.addScopedClass(InitService, [Vfs]);
	container.addScopedClass(StateService, [Vfs]);
	container.addScopedClass(EnvironmentService, [Vfs, StateService]);

	return container;
}
