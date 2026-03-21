import { S3Client } from '@aws-sdk/client-s3';
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
	container.addScopedFactory(S3Client, () => {
		return new S3Client({});
	});
	container.addScopedFactory(EnvironmentService, (t) => {
		const vfs = t.get(Vfs);
		const stateService = t.get(StateService);
		const s3Client = t.get(S3Client);

		return new EnvironmentService(vfs, stateService, s3Client);
	});

	return container;
}
