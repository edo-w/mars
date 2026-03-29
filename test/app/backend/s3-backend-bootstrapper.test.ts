import assert from 'node:assert/strict';
import { HeadBucketCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { test, vi } from 'vitest';
import { stringify } from 'yaml';
import { S3BackendBootstrapper } from '#src/app/backend/s3-backend-bootstrapper';
import { ConfigService } from '#src/app/config/config-service';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { StateService } from '#src/app/state/state-service';
import { toMarsConfigText } from '#test/helpers/mars-config';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const configService = new ConfigService(vfs);
	const stateService = new StateService(vfs, configService);
	const s3Client = new S3Client({
		region: 'us-east-1',
	});
	const environmentService = new EnvironmentService(vfs, configService, stateService);
	const service = new S3BackendBootstrapper(configService, s3Client);

	return {
		environmentService,
		s3Client,
		service,
		vfs,
	};
}

test('S3BackendBootstrapper creates the environment bucket when it does not exist', async () => {
	const { environmentService, s3Client, service, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async (command) => {
		if (command instanceof HeadBucketCommand) {
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

	const environment = await environmentService.get('gl-dev');

	if (environment === null) {
		throw new Error('missing environment');
	}

	const result = await service.bootstrap(environment);
	const commandTypes = send.mock.calls.map(([command]) => command.constructor.name);

	assert.deepEqual(commandTypes, [
		'HeadBucketCommand',
		'CreateBucketCommand',
		'PutBucketEncryptionCommand',
		'PutPublicAccessBlockCommand',
		'PutBucketPolicyCommand',
	]);
	assert.deepEqual(result, {
		kind: 'created',
		resource_label: 's3 bucket "gl-dev-infra-10000"',
	});
});

test('S3BackendBootstrapper returns already_exists when the environment bucket exists', async () => {
	const { environmentService, s3Client, service, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toMarsConfigText({
		backend: {
			s3: {
				bucket: '{namespace}-{env_name}-{env}-{aws_account_id}-{aws_region}',
			},
		},
	});
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async () => {
		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environment = await environmentService.get('gl-dev');

	if (environment === null) {
		throw new Error('missing environment');
	}

	const result = await service.bootstrap(environment);
	const commandTypes = send.mock.calls.map(([command]) => command.constructor.name);

	assert.deepEqual(commandTypes, ['HeadBucketCommand']);
	assert.deepEqual(result, {
		kind: 'already_exists',
		resource_label: 's3 bucket "gl-dev-gl-dev-10000-us-east-1"',
	});
});

test('S3BackendBootstrapper describes destroy resources for the environment bucket', async () => {
	const { environmentService, service, vfs } = sut();
	const marsConfig = toMarsConfigText();
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environment = await environmentService.get('gl-dev');

	if (environment === null) {
		throw new Error('missing environment');
	}

	const resources = await service.describeDestroy(environment);

	assert.deepEqual(resources, [
		{
			kind: 's3_bucket',
			label: 's3 bucket "gl-dev-infra-10000"',
			status: 'destroy',
		},
	]);
});

test('S3BackendBootstrapper deletes and empties the environment bucket during destroy', async () => {
	const { environmentService, s3Client, service, vfs } = sut();
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
						Key: 'one.txt',
					},
				],
				IsTruncated: false,
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environment = await environmentService.get('gl-dev');

	if (environment === null) {
		throw new Error('missing environment');
	}

	const result = await service.destroy(environment);
	const commandTypes = send.mock.calls.map(([command]) => command.constructor.name);

	assert.deepEqual(commandTypes, [
		'HeadBucketCommand',
		'ListObjectsV2Command',
		'DeleteObjectsCommand',
		'DeleteBucketCommand',
	]);
	assert.deepEqual(result, {
		kind: 'success',
		resources: [
			{
				kind: 's3_bucket',
				label: 's3 bucket "gl-dev-infra-10000"',
				status: 'destroy',
			},
		],
	});
});
