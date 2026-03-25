import assert from 'node:assert/strict';
import { S3Client } from '@aws-sdk/client-s3';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { stringify } from 'yaml';
import { BackendFactory } from '#src/cli/app/backend/backend-factory';
import { ConfigService } from '#src/cli/app/config/config-service';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { PasswordSecretsProvider } from '#src/cli/app/secrets/password-secrets-provider';
import { StateService } from '#src/cli/app/state/state-service';
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

	const backendFactory = new BackendFactory(t);
	const service = new PasswordSecretsProvider(backendFactory);

	return {
		service,
		t,
		vfs,
	};
}

test('PasswordSecretsProvider stores wrapped data key material in the backend', async () => {
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

		const dataKey = await service.getDataKey(environment);
		const dataKeyFile = vfs.files.get('/repo/.mars/local/envs/gl-dev/secrets/datakey.enc');
		const kdfFile = vfs.files.get('/repo/.mars/local/envs/gl-dev/secrets/kdf.json');

		assert.equal(dataKey.length, 32);
		assert.notEqual(dataKeyFile, undefined);
		assert.notEqual(kdfFile, undefined);
	} finally {
		restoreEnvVar('MARS_SECRETS_PASSWORD', previousPassword);
	}
});

test('PasswordSecretsProvider prefers the environment scoped password variable', async () => {
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
	const previousGeneralPassword = process.env.MARS_SECRETS_PASSWORD;
	const previousScopedPassword = process.env.MARS_SECRETS_PASSWORD_GL_DEV;

	process.env.MARS_SECRETS_PASSWORD = 'general-secret';
	process.env.MARS_SECRETS_PASSWORD_GL_DEV = 'scoped-secret';
	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	try {
		const environmentService = t.get(EnvironmentService);
		const environment = await environmentService.get('gl-dev');

		if (environment === null) {
			throw new Error('missing environment');
		}

		await service.getDataKey(environment);
		delete process.env.MARS_SECRETS_PASSWORD_GL_DEV;

		await assert.rejects(async () => {
			await service.getDataKey(environment);
		});
	} finally {
		restoreEnvVar('MARS_SECRETS_PASSWORD', previousGeneralPassword);
		restoreEnvVar('MARS_SECRETS_PASSWORD_GL_DEV', previousScopedPassword);
	}
});

function restoreEnvVar(name: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[name];
		return;
	}

	process.env[name] = value;
}
