import assert from 'node:assert/strict';
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { stringify } from 'yaml';
import { BackendFactory } from '#src/cli/app/backend/backend-factory';
import { ConfigService } from '#src/cli/app/config/config-service';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { StateService } from '#src/cli/app/state/state-service';
import { SshKeygen } from '#src/lib/ssh';
import { Vfs } from '#src/lib/vfs';
import { toMarsConfigText } from '#test/helpers/mars-config';
import { MockSshKeygen } from '#test/mocks/mock-ssh-keygen';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const s3Client = new S3Client({
		region: 'us-east-1',
	});
	const sshKeygen = new MockSshKeygen(vfs);
	const t = new Tiny();

	t.addInstance(Vfs, vfs as Vfs);
	t.addInstance(SshKeygen, sshKeygen as SshKeygen);
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

	const configService = t.get(ConfigService);
	const backendFactory = new BackendFactory(t);
	const service = new SshCaService(vfs, configService, backendFactory, sshKeygen as SshKeygen);

	return {
		service,
		s3Client,
		sshKeygen,
		t,
		vfs,
	};
}

test('SshCaService lists ssh ca names from the backend', async () => {
	const { service, s3Client, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async (command) => {
		if (command instanceof ListObjectsV2Command) {
			return {
				Contents: [
					{
						Key: 'mars/env/gl-dev/ssh/ca/deploy_ca_ed25519.pub',
					},
					{
						Key: 'mars/env/gl-dev/ssh/ca/default_ca_ed25519.key',
					},
					{
						Key: 'mars/env/gl-test/ssh/ca/test_ca_ed25519.pub',
					},
				],
				IsTruncated: false,
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const sshCaNames = environment === null ? [] : await service.list(environment);

	assert.deepEqual(sshCaNames, ['default', 'deploy']);
});

test('SshCaService shows ssh ca details from the backend', async () => {
	const { service, s3Client, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const createDate = new Date('2026-03-22T12:00:00.000Z');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async (command) => {
		if (command instanceof HeadObjectCommand) {
			return {
				LastModified: createDate,
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const sshCa = environment === null ? null : await service.show(environment, 'default');

	assert.equal(sshCa?.name, 'default');
	assert.equal(sshCa?.public_key, 's3://gl-dev-infra-10000/mars/env/gl-dev/ssh/ca/default_ca_ed25519.pub');
	assert.equal(sshCa?.private_key, 's3://gl-dev-infra-10000/mars/env/gl-dev/ssh/ca/default_ca_ed25519.key');
	assert.equal(sshCa?.create_date.toISOString(), createDate.toISOString());
});

test('SshCaService treats an existing local keypair as already existing', async () => {
	const { service, s3Client, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);
	vfs.setTextFile('.mars/env/gl-dev/ssh/ca/default_ca_ed25519.key', 'LOCAL PRIVATE KEY');

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const result = environment === null ? null : await service.create(environment, 'default', 'secret');
	const commandCount = send.mock.calls.length;

	assert.deepEqual(result, {
		kind: 'already_exists',
		name: 'default',
	});
	assert.equal(commandCount, 0);
});

test('SshCaService creates an ssh ca and uploads both files through the backend', async () => {
	const { service, s3Client, sshKeygen, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const createDate = new Date('2026-03-22T12:00:00.000Z');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	sshKeygen.privateKeyContents = 'GENERATED PRIVATE KEY';
	sshKeygen.publicKeyContents = 'GENERATED PUBLIC KEY';
	send.mockImplementation(async (command) => {
		if (command instanceof HeadObjectCommand) {
			if (command.input.Key === 'mars/env/gl-dev/ssh/ca/default_ca_ed25519.key') {
				return command.input.Bucket === 'gl-dev-infra-10000' &&
					send.mock.calls.filter(([call]) => call instanceof PutObjectCommand).length > 0
					? {
							LastModified: createDate,
						}
					: Promise.reject({
							$metadata: {
								httpStatusCode: 404,
							},
							name: 'NotFound',
						});
			}

			if (command.input.Key === 'mars/env/gl-dev/ssh/ca/default_ca_ed25519.pub') {
				return send.mock.calls.filter(([call]) => call instanceof PutObjectCommand).length > 0
					? {
							LastModified: createDate,
						}
					: Promise.reject({
							$metadata: {
								httpStatusCode: 404,
							},
							name: 'NotFound',
						});
			}
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const result = environment === null ? null : await service.create(environment, 'default', 'secret');
	const privateKey = vfs.files.get('/repo/.mars/env/gl-dev/ssh/ca/default_ca_ed25519.key');
	const publicKey = vfs.files.get('/repo/.mars/env/gl-dev/ssh/ca/default_ca_ed25519.pub');
	const putCommands = send.mock.calls.filter(([command]) => command instanceof PutObjectCommand);

	assert.equal(result?.kind, 'created');
	assert.equal(result?.ssh_ca.name, 'default');
	assert.equal(privateKey, 'GENERATED PRIVATE KEY');
	assert.equal(publicKey, 'GENERATED PUBLIC KEY');
	assert.equal(putCommands.length, 2);
});

test('SshCaService stores durable ssh ca files in the local backend when configured', async () => {
	const { service, sshKeygen, t, vfs } = sut();
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

	sshKeygen.privateKeyContents = 'GENERATED PRIVATE KEY';
	sshKeygen.publicKeyContents = 'GENERATED PUBLIC KEY';
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const result = environment === null ? null : await service.create(environment, 'default', 'secret');
	const backendPrivateKey = vfs.files.get('/repo/.mars/local/env/gl-dev/ssh/ca/default_ca_ed25519.key');
	const backendPublicKey = vfs.files.get('/repo/.mars/local/env/gl-dev/ssh/ca/default_ca_ed25519.pub');

	assert.equal(result?.kind, 'created');
	assert.equal(backendPrivateKey, 'GENERATED PRIVATE KEY');
	assert.equal(backendPublicKey, 'GENERATED PUBLIC KEY');
});

test('SshCaService returns corrupted when pull is missing backend files', async () => {
	const { service, s3Client, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async (command) => {
		if (command instanceof HeadObjectCommand) {
			if (command.input.Key === 'mars/env/gl-dev/ssh/ca/default_ca_ed25519.pub') {
				return {
					LastModified: new Date('2026-03-22T12:00:00.000Z'),
				};
			}

			throw {
				$metadata: {
					httpStatusCode: 404,
				},
				name: 'NotFound',
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const result = environment === null ? null : await service.pull(environment, 'default');

	assert.deepEqual(result, {
		kind: 'corrupted',
		missing_files: ['env/gl-dev/ssh/ca/default_ca_ed25519.key'],
		name: 'default',
	});
});

test('SshCaService returns not_found when pull is missing both backend files', async () => {
	const { service, s3Client, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async (command) => {
		if (command instanceof HeadObjectCommand) {
			throw {
				$metadata: {
					httpStatusCode: 404,
				},
				name: 'NotFound',
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const result = environment === null ? null : await service.pull(environment, 'default');

	assert.deepEqual(result, {
		kind: 'not_found',
		name: 'default',
	});
});

test('SshCaService pulls an ssh ca into the work path', async () => {
	const { service, s3Client, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const createDate = new Date('2026-03-22T12:00:00.000Z');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});
	const privateKeyBody = createObjectBody('PULLED PRIVATE KEY');
	const publicKeyBody = createObjectBody('PULLED PUBLIC KEY');

	send.mockImplementation(async (command) => {
		if (command instanceof HeadObjectCommand) {
			return {
				LastModified: createDate,
			};
		}

		if (command instanceof GetObjectCommand) {
			return {
				Body:
					command.input.Key === 'mars/env/gl-dev/ssh/ca/default_ca_ed25519.key'
						? privateKeyBody
						: publicKeyBody,
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const result = environment === null ? null : await service.pull(environment, 'default');
	const privateKey = vfs.files.get('/repo/.mars/env/gl-dev/ssh/ca/default_ca_ed25519.key');
	const publicKey = vfs.files.get('/repo/.mars/env/gl-dev/ssh/ca/default_ca_ed25519.pub');

	assert.equal(result?.kind, 'pulled');
	assert.equal(privateKey, 'PULLED PRIVATE KEY');
	assert.equal(publicKey, 'PULLED PUBLIC KEY');
});

test('SshCaService describes destroy resources from the backend and local cache', async () => {
	const { service, s3Client, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async () => {
		return {
			LastModified: new Date('2026-03-22T12:00:00.000Z'),
		};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);
	vfs.setTextFile('.mars/env/gl-dev/ssh/ca/default_ca_ed25519.key', 'LOCAL PRIVATE KEY');

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const resources = environment === null ? null : await service.describeDestroy(environment, 'default');

	assert.deepEqual(resources, [
		{
			label: 'backend file "s3://gl-dev-infra-10000/mars/env/gl-dev/ssh/ca/default_ca_ed25519.key"',
		},
		{
			label: 'backend file "s3://gl-dev-infra-10000/mars/env/gl-dev/ssh/ca/default_ca_ed25519.pub"',
		},
		{
			label: 'local file ".mars/env/gl-dev/ssh/ca/default_ca_ed25519.key"',
		},
	]);
});

test('SshCaService returns not_found when destroy has no resources', async () => {
	const { service, s3Client, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async () => {
		throw {
			$metadata: {
				httpStatusCode: 404,
			},
			name: 'NotFound',
		};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const result = environment === null ? null : await service.destroy(environment, 'default');

	assert.deepEqual(result, {
		kind: 'not_found',
		name: 'default',
	});
});

test('SshCaService destroys ssh ca files from the backend and local cache', async () => {
	const { service, s3Client, t, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async (command) => {
		if (command instanceof HeadObjectCommand) {
			return {
				LastModified: new Date('2026-03-22T12:00:00.000Z'),
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);
	vfs.setTextFile('.mars/env/gl-dev/ssh/ca/default_ca_ed25519.key', 'LOCAL PRIVATE KEY');
	vfs.setTextFile('.mars/env/gl-dev/ssh/ca/default_ca_ed25519.pub', 'LOCAL PUBLIC KEY');

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const result = environment === null ? null : await service.destroy(environment, 'default');
	const deleteCommands = send.mock.calls.filter(([command]) => command instanceof DeleteObjectCommand);
	const privateKey = vfs.files.get('/repo/.mars/env/gl-dev/ssh/ca/default_ca_ed25519.key');
	const publicKey = vfs.files.get('/repo/.mars/env/gl-dev/ssh/ca/default_ca_ed25519.pub');

	assert.equal(result?.kind, 'destroyed');
	assert.equal(deleteCommands.length, 2);
	assert.equal(privateKey, undefined);
	assert.equal(publicKey, undefined);
});

test('SshCaService remove only deletes local files for the resolved environment', async () => {
	const { service, t, vfs } = sut();
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);
	vfs.setTextFile('.mars/env/gl-dev/ssh/ca/default_ca_ed25519.key', 'DEV PRIVATE KEY');
	vfs.setTextFile('.mars/env/gl-test/ssh/ca/default_ca_ed25519.key', 'TEST PRIVATE KEY');

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');
	const removed = environment === null ? false : await service.remove(environment, 'default');
	const devPrivateKey = vfs.files.get('/repo/.mars/env/gl-dev/ssh/ca/default_ca_ed25519.key');
	const testPrivateKey = vfs.files.get('/repo/.mars/env/gl-test/ssh/ca/default_ca_ed25519.key');

	assert.equal(removed, true);
	assert.equal(devPrivateKey, undefined);
	assert.equal(testPrivateKey, 'TEST PRIVATE KEY');
});

function createObjectBody(contents: string) {
	return {
		async transformToString(): Promise<string> {
			return contents;
		},
	};
}
