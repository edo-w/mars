import assert from 'node:assert/strict';
import { S3Client } from '@aws-sdk/client-s3';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { BackendBootstrapperFactory } from '#src/app/backend/backend-bootstrapper-factory';
import { LocalBackendBootstrapper } from '#src/app/backend/local-backend-bootstrapper';
import { S3BackendBootstrapper } from '#src/app/backend/s3-backend-bootstrapper';
import { ConfigService } from '#src/app/config/config-service';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { StateService } from '#src/app/state/state-service';
import { Vfs } from '#src/lib/vfs';
import { toMarsConfigText } from '#test/helpers/mars-config';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const s3Client = new S3Client({
		region: 'us-east-1',
	});
	const t = new Tiny();

	t.addInstance(Vfs, vfs as Vfs);
	t.addSingletonClass(ConfigService, [Vfs]);
	t.addScopedClass(StateService, [Vfs, ConfigService]);
	t.addScopedFactory(S3Client, () => {
		return s3Client;
	});
	t.addScopedFactory(EnvironmentService, (t) => {
		const vfs = t.get(Vfs);
		const configService = t.get(ConfigService);
		const stateService = t.get(StateService);

		return new EnvironmentService(vfs, configService, stateService);
	});

	const service = new BackendBootstrapperFactory(t);

	return {
		service,
		vfs,
	};
}

test('BackendBootstrapperFactory creates a local backend bootstrapper', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const bootstrapper = await service.create();

	assert.equal(bootstrapper instanceof LocalBackendBootstrapper, true);
});

test('BackendBootstrapperFactory creates an s3 backend bootstrapper', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		backend: {
			s3: {
				bucket: '{env}-infra-{aws_account_id}',
			},
		},
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const bootstrapper = await service.create();

	assert.equal(bootstrapper instanceof S3BackendBootstrapper, true);
});
