import assert from 'node:assert/strict';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { stringify } from 'yaml';
import { BackendFactory } from '#src/app/backend/backend-factory';
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

	const service = new BackendFactory(t);

	return {
		s3Client,
		service,
		t,
		vfs,
	};
}

test('BackendFactory creates a local backend when backend.local is configured', async () => {
	const { service, t, vfs } = sut();
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
	});
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');

	if (environment === null) {
		throw new Error('missing environment');
	}

	const backendService = await service.create();

	await backendService.writeTextFile(environment, 'env/gl-dev/ssh/ca/default_ca_ed25519.key', 'PRIVATE KEY');

	const backendFile = vfs.files.get('/repo/.mars/local/env/gl-dev/ssh/ca/default_ca_ed25519.key');
	const backendPath = await backendService.getFilePath(environment, 'env/gl-dev/ssh/ca/default_ca_ed25519.key');
	const backendInfo = await backendService.getInfo(environment);

	assert.equal(backendFile, 'PRIVATE KEY');
	assert.equal(backendPath, './.mars/local/env/gl-dev/ssh/ca/default_ca_ed25519.key');
	assert.deepEqual(backendInfo, {
		fields: [
			{
				name: 'local_path',
				value: './.mars/local',
			},
		],
		type: 'local',
	});
});

test('BackendFactory creates an s3 backend when backend.s3 is configured', async () => {
	const { s3Client, service, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});
	const objectBody = createObjectBody('PRIVATE KEY');

	send.mockImplementation(async (command) => {
		if (command instanceof ListObjectsV2Command) {
			return {
				Contents: [
					{
						Key: 'mars/env/gl-dev/ssh/ca/default_ca_ed25519.key',
					},
				],
				IsTruncated: false,
			};
		}

		if (command instanceof GetObjectCommand) {
			return {
				Body: objectBody,
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');

	if (environment === null) {
		throw new Error('missing environment');
	}

	const backendService = await service.create();

	await backendService.writeTextFile(environment, 'env/gl-dev/ssh/ca/default_ca_ed25519.key', 'PRIVATE KEY');

	const backendPath = await backendService.getFilePath(environment, 'env/gl-dev/ssh/ca/default_ca_ed25519.key');
	const backendInfo = await backendService.getInfo(environment);
	const fileNames = await backendService.listDirectory(environment, 'env/gl-dev/ssh/ca');
	const contents = await backendService.readTextFile(environment, 'env/gl-dev/ssh/ca/default_ca_ed25519.key');
	const putCommand = send.mock.calls.find(([command]) => command instanceof PutObjectCommand)?.[0] as
		| PutObjectCommand
		| undefined;

	assert.equal(backendPath, 's3://gl-dev-infra-10000/mars/env/gl-dev/ssh/ca/default_ca_ed25519.key');
	assert.deepEqual(backendInfo, {
		fields: [
			{
				name: 'env_bucket',
				value: 'gl-dev-infra-10000',
			},
		],
		type: 's3',
	});
	assert.deepEqual(fileNames, ['default_ca_ed25519.key']);
	assert.equal(contents, 'PRIVATE KEY');
	assert.equal(putCommand?.input.Key, 'mars/env/gl-dev/ssh/ca/default_ca_ed25519.key');
});

function createObjectBody(contents: string) {
	return {
		async transformToString(): Promise<string> {
			return contents;
		},
	};
}
