import assert from 'node:assert/strict';
import { DeleteBucketCommand, HeadBucketCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { test, vi } from 'vitest';
import { stringify } from 'yaml';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { StateService } from '#src/cli/app/state/state-service';
import { toJsonText } from '#test/helpers/json';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const stateService = new StateService(vfs);
	const s3Client = new S3Client({
		region: 'us-east-1',
	});
	const service = new EnvironmentService(vfs, stateService, s3Client);

	return {
		s3Client,
		service,
		vfs,
	};
}

test('EnvironmentService lists environments from envs_path', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '111111111111',
		aws_region: 'us-east-1',
	});
	const testEnvironment = stringify({
		name: 'test',
		namespace: 'gl',
		aws_account_id: '111111111111',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);
	vfs.setTextFile('infra/envs/test/environment.yml', testEnvironment);

	const environments = await service.list();
	const environmentIds = environments.map((environment) => environment.id);

	assert.deepEqual(environmentIds, ['gl-dev', 'gl-test']);
});

test('EnvironmentService marks the selected environment during list', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const stateFile = toJsonText({
		selected_environment: 'infra/envs/dev/environment.yml',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '111111111111',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('.mars/state.json', stateFile);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const environments = await service.list();
	const selectedEnvironment = environments[0];

	assert.equal(selectedEnvironment?.selected, true);
});

test('EnvironmentService returns the selected environment', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const stateFile = toJsonText({
		selected_environment: 'infra/envs/dev/environment.yml',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '111111111111',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('.mars/state.json', stateFile);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const environment = await service.getCurrent();

	assert.equal(environment?.id, 'gl-dev');
});

test('EnvironmentService creates a new environment from config namespace', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'app',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const environment = await service.create('dev');
	const environmentFile = vfs.files.get('/repo/infra/envs/dev/environment.yml');
	const expectedEnvironmentFile = stringify({
		namespace: 'app',
		name: 'dev',
		aws_account_id: 'TODO',
		aws_region: 'TODO',
	});

	assert.equal(environment?.id, 'app-dev');
	assert.equal(environmentFile, expectedEnvironmentFile);
});

test('EnvironmentService does not create an environment that already exists', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'app',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'app',
		aws_account_id: 'TODO',
		aws_region: 'TODO',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environment = await service.create('dev');

	assert.equal(environment, null);
});

test('EnvironmentService selects an environment by id', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '111111111111',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const environment = await service.select('gl-dev');
	const stateFile = vfs.files.get('/repo/.mars/state.json');
	const expectedStateFile = toJsonText({
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	assert.equal(environment?.selected, true);
	assert.equal(stateFile, expectedStateFile);
});

test('EnvironmentService returns null when selecting a missing environment', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const environment = await service.select('gl-dev');

	assert.equal(environment, null);
});

test('EnvironmentService bootstraps the resolved bucket when it does not exist', async () => {
	const { s3Client, service, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const devEnvironment = stringify({
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
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const result = await service.bootstrap('gl-dev');
	const commandTypes = send.mock.calls.map(([command]) => command.constructor.name);

	assert.deepEqual(commandTypes, [
		'HeadBucketCommand',
		'CreateBucketCommand',
		'PutBucketEncryptionCommand',
		'PutPublicAccessBlockCommand',
		'PutBucketPolicyCommand',
	]);
	assert.deepEqual(result, {
		bucket: 'gl-dev-infra-10000',
		kind: 'created',
	});
});

test('EnvironmentService returns already_exists when the bucket exists', async () => {
	const { s3Client, service, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async () => {
		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const result = await service.bootstrap('gl-dev');
	const commandTypes = send.mock.calls.map(([command]) => command.constructor.name);

	assert.deepEqual(commandTypes, ['HeadBucketCommand']);
	assert.deepEqual(result, {
		bucket: 'gl-dev-infra-10000',
		kind: 'already_exists',
	});
});

test('EnvironmentService resolves env_bucket template variables', async () => {
	const { s3Client, service, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{namespace}-{env_name}-{env}-{aws_account_id}-{aws_region}',
		work_path: '.mars',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async () => {
		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const result = await service.bootstrap('gl-dev');

	assert.deepEqual(result, {
		bucket: 'gl-dev-gl-dev-10000-us-east-1',
		kind: 'already_exists',
	});
});

test('EnvironmentService returns not_selected when bootstrap has no selected environment', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const result = await service.bootstrap(null);

	assert.deepEqual(result, {
		kind: 'not_selected',
	});
});

test('EnvironmentService returns not_found when bootstrap env does not exist', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const result = await service.bootstrap('gl-dev');

	assert.deepEqual(result, {
		kind: 'not_found',
		name: 'gl-dev',
	});
});

test('EnvironmentService returns the resolved bucket name for an environment', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const environment = await service.get('gl-dev');
	const bucket = environment === null ? null : await service.getBucketName(environment);

	assert.equal(bucket, 'gl-dev-infra-10000');
});

test('EnvironmentService describes destroy resources for an environment', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const environment = await service.get('gl-dev');
	const resources = environment === null ? [] : await service.describeDestroy(environment);

	assert.equal(environment?.id, 'gl-dev');
	assert.equal(environment?.directoryPath, 'infra/envs/dev');
	assert.equal(environment?.configPath, 'infra/envs/dev/environment.yml');
	assert.equal(environment?.config.namespace, 'gl');
	assert.equal(environment?.config.name, 'dev');
	assert.equal(environment?.config.aws_account_id, '10000');
	assert.equal(environment?.config.aws_region, 'us-east-1');
	assert.deepEqual(resources, [
		{
			kind: 's3_bucket',
			label: 's3 bucket "gl-dev-infra-10000"',
			status: 'destroy',
		},
	]);
});

test('EnvironmentService deletes and empties a bucket during destroy', async () => {
	const { s3Client, service, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const devEnvironment = stringify({
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
					{
						Key: 'two.txt',
					},
				],
				IsTruncated: false,
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const result = await service.destroy('gl-dev');
	const commandTypes = send.mock.calls.map(([command]) => command.constructor.name);
	const environment = result.kind === 'success' ? result.environment : null;
	const resources = result.kind === 'success' ? result.resources : [];

	assert.deepEqual(commandTypes, [
		'HeadBucketCommand',
		'ListObjectsV2Command',
		'DeleteObjectsCommand',
		'DeleteBucketCommand',
	]);
	assert.equal(result.kind, 'success');
	assert.equal(environment?.id, 'gl-dev');
	assert.equal(environment?.directoryPath, 'infra/envs/dev');
	assert.equal(environment?.configPath, 'infra/envs/dev/environment.yml');
	assert.equal(environment?.config.namespace, 'gl');
	assert.equal(environment?.config.name, 'dev');
	assert.equal(environment?.config.aws_account_id, '10000');
	assert.equal(environment?.config.aws_region, 'us-east-1');
	assert.deepEqual(resources, [
		{
			kind: 's3_bucket',
			label: 's3 bucket "gl-dev-infra-10000"',
			status: 'destroy',
		},
	]);
});

test('EnvironmentService returns success with not_found resource when destroy bucket is missing', async () => {
	const { s3Client, service, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const devEnvironment = stringify({
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
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const result = await service.destroy('gl-dev');
	const commandTypes = send.mock.calls.map(([command]) => command.constructor.name);
	const environment = result.kind === 'success' ? result.environment : null;
	const resources = result.kind === 'success' ? result.resources : [];

	assert.deepEqual(commandTypes, ['HeadBucketCommand']);
	assert.equal(result.kind, 'success');
	assert.equal(environment?.id, 'gl-dev');
	assert.equal(environment?.directoryPath, 'infra/envs/dev');
	assert.equal(environment?.configPath, 'infra/envs/dev/environment.yml');
	assert.equal(environment?.config.namespace, 'gl');
	assert.equal(environment?.config.name, 'dev');
	assert.equal(environment?.config.aws_account_id, '10000');
	assert.equal(environment?.config.aws_region, 'us-east-1');
	assert.deepEqual(resources, [
		{
			kind: 's3_bucket',
			label: 's3 bucket "gl-dev-infra-10000"',
			status: 'not_found',
		},
	]);
});

test('EnvironmentService returns fail when destroy errors', async () => {
	const { s3Client, service, vfs } = sut();
	const send = vi.spyOn(s3Client, 'send');
	const deleteError = new Error('delete failed');
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		env_bucket: '{env}-infra-{aws_account_id}',
		work_path: '.mars',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async (command) => {
		if (command instanceof DeleteBucketCommand) {
			throw deleteError;
		}

		if (command instanceof ListObjectsV2Command) {
			return {
				Contents: [],
				IsTruncated: false,
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const result = await service.destroy('gl-dev');
	const environment = result.kind === 'fail' ? result.environment : null;
	const resources = result.kind === 'fail' ? result.resources : [];

	assert.equal(result.kind, 'fail');
	assert.equal(result.error, deleteError);
	assert.equal(environment?.id, 'gl-dev');
	assert.deepEqual(resources, []);
});
