import assert from 'node:assert/strict';
import { KMSClient } from '@aws-sdk/client-kms';
import { S3Client } from '@aws-sdk/client-s3';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { stringify } from 'yaml';
import { BackendFactory } from '#src/cli/app/backend/backend-factory';
import { ConfigService } from '#src/cli/app/config/config-service';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KeyAgentSecretsService } from '#src/cli/app/secrets/key-agent-secrets-service';
import { KmsSecretsProvider } from '#src/cli/app/secrets/kms-secrets-provider';
import { PasswordSecretsProvider } from '#src/cli/app/secrets/password-secrets-provider';
import { SecretsProviderFactory } from '#src/cli/app/secrets/secrets-provider-factory';
import { StateService } from '#src/cli/app/state/state-service';
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
	t.addScopedFactory(KMSClient, () => {
		return kmsClient;
	});
	t.addScopedFactory(PasswordSecretsProvider, (t) => {
		const backendFactory = new BackendFactory(t);

		return new PasswordSecretsProvider(backendFactory);
	});
	t.addScopedFactory(KmsSecretsProvider, (t) => {
		const backendFactory = new BackendFactory(t);
		const kmsClient = t.get(KMSClient);

		return new KmsSecretsProvider(backendFactory, kmsClient);
	});

	t.addScopedFactory(SecretsProviderFactory, (t) => {
		return new SecretsProviderFactory(t);
	});

	const service = new KeyAgentSecretsService(t.get(SecretsProviderFactory));

	return {
		service,
		t,
		vfs,
	};
}

test('KeyAgentSecretsService encrypts and decrypts text with the password provider', async () => {
	const { service, t, vfs } = sut();
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
		secrets: {
			password: {},
		},
	});
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '10000',
		aws_region: 'us-east-1',
	});
	const previousPassword = process.env.MARS_SECRETS_PASSWORD;

	process.env.MARS_SECRETS_PASSWORD = 'secret';
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	try {
		const environmentService = t.get(EnvironmentService);
		const environment = await environmentService.get('gl-dev');

		if (environment === null) {
			throw new Error('missing environment');
		}

		const encryptedSecret = await service.encryptText(environment, 'mars secret');
		const plaintext = await service.decryptText(environment, encryptedSecret);

		assert.notEqual(encryptedSecret.ciphertext, 'mars secret');
		assert.equal(plaintext, 'mars secret');
	} finally {
		if (previousPassword === undefined) {
			delete process.env.MARS_SECRETS_PASSWORD;
		} else {
			process.env.MARS_SECRETS_PASSWORD = previousPassword;
		}
	}
});
