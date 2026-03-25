import assert from 'node:assert/strict';
import { KMSClient } from '@aws-sdk/client-kms';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { ConfigService } from '#src/cli/app/config/config-service';
import { KmsSecretsBootstrapper } from '#src/cli/app/secrets/kms-secrets-bootstrapper';
import { PasswordSecretsBootstrapper } from '#src/cli/app/secrets/password-secrets-bootstrapper';
import { SecretsBootstrapperFactory } from '#src/cli/app/secrets/secrets-bootstrapper-factory';
import { Vfs } from '#src/lib/vfs';
import { toMarsConfigText } from '#test/helpers/mars-config';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const kmsClient = new KMSClient({
		region: 'us-east-1',
	});
	const t = new Tiny();

	t.addInstance(Vfs, vfs as Vfs);
	t.addSingletonClass(ConfigService, [Vfs]);
	t.addScopedFactory(KMSClient, () => {
		return kmsClient;
	});

	const service = new SecretsBootstrapperFactory(t);

	return {
		service,
		vfs,
	};
}

test('SecretsBootstrapperFactory creates a password secrets bootstrapper', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		secrets: {
			password: {},
		},
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const bootstrapper = await service.create();

	assert.equal(bootstrapper instanceof PasswordSecretsBootstrapper, true);
});

test('SecretsBootstrapperFactory creates a kms secrets bootstrapper', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		secrets: {
			kms: {},
		},
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const bootstrapper = await service.create();

	assert.equal(bootstrapper instanceof KmsSecretsBootstrapper, true);
});
