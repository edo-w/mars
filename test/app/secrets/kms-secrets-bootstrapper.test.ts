import assert from 'node:assert/strict';
import { DescribeKeyCommand, KMSClient } from '@aws-sdk/client-kms';
import { test, vi } from 'vitest';
import { stringify } from 'yaml';
import { ConfigService } from '#src/app/config/config-service';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { KmsSecretsBootstrapper } from '#src/app/secrets/kms-secrets-bootstrapper';
import { StateService } from '#src/app/state/state-service';
import { toMarsConfigText } from '#test/helpers/mars-config';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const configService = new ConfigService(vfs);
	const stateService = new StateService(vfs, configService);
	const kmsClient = new KMSClient({
		region: 'us-east-1',
	});
	const environmentService = new EnvironmentService(vfs, configService, stateService);
	const service = new KmsSecretsBootstrapper(kmsClient);

	return {
		environmentService,
		kmsClient,
		service,
		vfs,
	};
}

test('KmsSecretsBootstrapper creates the environment key when it does not exist', async () => {
	const { environmentService, kmsClient, service, vfs } = sut();
	const send = vi.spyOn(kmsClient, 'send');
	const marsConfig = toMarsConfigText({
		secrets: {
			kms: {},
		},
	});
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async (command) => {
		if (command instanceof DescribeKeyCommand) {
			throw {
				name: 'NotFoundException',
			};
		}

		if (command.constructor.name === 'CreateKeyCommand') {
			return {
				KeyMetadata: {
					KeyId: 'kms-key-1',
				},
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
		'DescribeKeyCommand',
		'CreateKeyCommand',
		'EnableKeyRotationCommand',
		'CreateAliasCommand',
	]);
	assert.deepEqual(result, {
		kind: 'created',
		resource_label: 'kms key "alias/mars-gl-dev-secrets"',
	});
});

test('KmsSecretsBootstrapper returns already_exists when the environment key exists', async () => {
	const { environmentService, kmsClient, service, vfs } = sut();
	const send = vi.spyOn(kmsClient, 'send');
	const marsConfig = toMarsConfigText({
		secrets: {
			kms: {},
		},
	});
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async () => {
		return {
			KeyMetadata: {
				KeyId: 'kms-key-1',
			},
		};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environment = await environmentService.get('gl-dev');

	if (environment === null) {
		throw new Error('missing environment');
	}

	const result = await service.bootstrap(environment);
	const commandTypes = send.mock.calls.map(([command]) => command.constructor.name);

	assert.deepEqual(commandTypes, ['DescribeKeyCommand']);
	assert.deepEqual(result, {
		kind: 'already_exists',
		resource_label: 'kms key "alias/mars-gl-dev-secrets"',
	});
});

test('KmsSecretsBootstrapper describes destroy resources for the environment key', async () => {
	const { environmentService, service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		secrets: {
			kms: {},
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

	const environment = await environmentService.get('gl-dev');

	if (environment === null) {
		throw new Error('missing environment');
	}

	const resources = await service.describeDestroy(environment);

	assert.deepEqual(resources, [
		{
			kind: 'kms_key',
			label: 'kms key "alias/mars-gl-dev-secrets"',
			status: 'destroy',
		},
	]);
});

test('KmsSecretsBootstrapper schedules key deletion during destroy', async () => {
	const { environmentService, kmsClient, service, vfs } = sut();
	const send = vi.spyOn(kmsClient, 'send');
	const marsConfig = toMarsConfigText({
		secrets: {
			kms: {},
		},
	});
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});

	send.mockImplementation(async (command) => {
		if (command instanceof DescribeKeyCommand) {
			return {
				KeyMetadata: {
					KeyId: 'kms-key-1',
				},
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
		'DescribeKeyCommand',
		'DeleteAliasCommand',
		'DisableKeyCommand',
		'ScheduleKeyDeletionCommand',
	]);
	assert.deepEqual(result, {
		kind: 'success',
		resources: [
			{
				kind: 'kms_key',
				label: 'kms key "alias/mars-gl-dev-secrets"',
				status: 'destroy',
			},
		],
	});
});
