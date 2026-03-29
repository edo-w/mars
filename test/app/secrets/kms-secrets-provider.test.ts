import assert from 'node:assert/strict';
import { DecryptCommand, DescribeKeyCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { S3Client } from '@aws-sdk/client-s3';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { stringify } from 'yaml';
import { BackendFactory } from '#src/app/backend/backend-factory';
import { ConfigService } from '#src/app/config/config-service';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { KmsSecretsProvider } from '#src/app/secrets/kms-secrets-provider';
import { StateService } from '#src/app/state/state-service';
import { Vfs } from '#src/lib/vfs';
import { toMarsConfigText } from '#test/helpers/mars-config';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const s3Client = new S3Client({
		region: 'us-east-1',
	});
	const kmsClient = new KMSClient({
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

	const backendFactory = new BackendFactory(t);
	const service = new KmsSecretsProvider(backendFactory, kmsClient);

	return {
		kmsClient,
		service,
		t,
		vfs,
	};
}

test('KmsSecretsProvider stores wrapped data key material in the backend', async () => {
	const { kmsClient, service, t, vfs } = sut();
	const send = vi.spyOn(kmsClient, 'send');
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
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
		if (command instanceof EncryptCommand) {
			return {
				CiphertextBlob: Uint8Array.from([1, 2, 3]),
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

	const dataKey = await service.getDataKey(environment);
	const dataKeyFile = vfs.files.get('/repo/.mars/local/env/gl-dev/secrets/datakey.enc');

	assert.equal(dataKey.length, 32);
	assert.equal(dataKeyFile, 'AQID');
});

test('KmsSecretsProvider decrypts an existing wrapped data key from the backend', async () => {
	const { kmsClient, service, t, vfs } = sut();
	const send = vi.spyOn(kmsClient, 'send');
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
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
		if (command instanceof DecryptCommand) {
			return {
				Plaintext: Uint8Array.from([9, 8, 7]),
			};
		}

		return {};
	});
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);
	vfs.setTextFile('.mars/local/env/gl-dev/secrets/datakey.enc', 'AQID');

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');

	if (environment === null) {
		throw new Error('missing environment');
	}

	const dataKey = await service.getDataKey(environment);

	assert.deepEqual([...dataKey], [9, 8, 7]);
});

test('KmsSecretsProvider returns kms info for the environment', async () => {
	const { kmsClient, service, t, vfs } = sut();
	const send = vi.spyOn(kmsClient, 'send');
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
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

	const environmentService = t.get(EnvironmentService);
	const environment = await environmentService.get('gl-dev');

	if (environment === null) {
		throw new Error('missing environment');
	}

	const info = await service.getInfo(environment);

	assert.deepEqual(info, {
		fields: [
			{
				name: 'kms_key_id',
				value: 'kms-key-1',
			},
			{
				name: 'kms_key_alias',
				value: 'alias/mars-gl-dev-secrets',
			},
		],
		type: 'kms',
	});
});
