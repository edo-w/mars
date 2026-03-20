import { Tiny } from '@edo-w/tiny';
import { InitService } from '#src/cli/app/init/init-service';
import { IVfs, NodeVfs } from '#src/lib/vfs';

export interface CreateContainerOptions {
	cwd: string;
}

export function createContainer(options: CreateContainerOptions): Tiny {
	const container = new Tiny();

	container.addSingletonFactory(IVfs, () => {
		return new NodeVfs(options.cwd);
	});
	container.addScopedClass(InitService, [IVfs]);

	return container;
}
