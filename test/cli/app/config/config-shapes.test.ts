import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
	createDefaultMarsConfig,
	ENVS_PATH,
	isKmsSecretsConfig,
	isLocalBackendConfig,
	isPasswordSecretsConfig,
	isS3BackendConfig,
	MarsConfig,
	NAMESPACE,
	WORK_PATH,
} from '#src/cli/app/config/config-shapes';

test('MarsConfig constructs from valid input', () => {
	const config = new MarsConfig({
		namespace: 'gl',
		envs_path: 'infra/envs',
		work_path: '.mars',
		backend: {
			s3: {
				bucket: '{env}-infra-{aws_account_id}',
			},
		},
		secrets: {
			password: {},
		},
	});

	assert.equal(config.namespace, 'gl');
	assert.equal(config.envs_path, 'infra/envs');
	assert.equal(config.work_path, '.mars');
	assert.equal(isS3BackendConfig(config.backend), true);
	assert.equal(isPasswordSecretsConfig(config.secrets), true);

	if (!isS3BackendConfig(config.backend) || !isPasswordSecretsConfig(config.secrets)) {
		throw new Error('invalid config shape');
	}

	assert.equal(config.backend.s3.bucket, '{env}-infra-{aws_account_id}');
});

test('MarsConfig defaults work_path when omitted', () => {
	const config = new MarsConfig({
		namespace: 'gl',
		envs_path: 'infra/envs',
		backend: {
			local: {},
		},
		secrets: {
			password: {},
		},
	});

	assert.equal(config.work_path, WORK_PATH);
});

test('MarsConfig fails construction for invalid input', () => {
	assert.throws(() => {
		new MarsConfig({
			envs_path: 'infra/envs',
			work_path: '.mars',
			backend: {
				local: {},
			},
			secrets: {
				password: {},
			},
		});
	});
});

test('MarsConfig rejects multiple backend providers', () => {
	assert.throws(() => {
		new MarsConfig({
			namespace: 'gl',
			envs_path: 'infra/envs',
			work_path: '.mars',
			backend: {
				local: {},
				s3: {
					bucket: '{env}-infra-{aws_account_id}',
				},
			},
			secrets: {
				password: {},
			},
		});
	});
});

test('MarsConfig rejects multiple secrets providers', () => {
	assert.throws(() => {
		new MarsConfig({
			namespace: 'gl',
			envs_path: 'infra/envs',
			work_path: '.mars',
			backend: {
				local: {},
			},
			secrets: {
				kms: {},
				password: {},
			},
		});
	});
});

test('createDefaultMarsConfig returns the default config', () => {
	const config = createDefaultMarsConfig();

	assert.equal(config.namespace, NAMESPACE);
	assert.equal(config.envs_path, ENVS_PATH);
	assert.equal(config.work_path, WORK_PATH);
	assert.equal(isLocalBackendConfig(config.backend), true);
	assert.equal(isPasswordSecretsConfig(config.secrets), true);
});

test('config type guards narrow the backend and secrets provider shapes', () => {
	const s3Backend = {
		s3: {
			bucket: 'bucket',
		},
	};
	const localBackend = {
		local: {},
	};
	const passwordSecrets = {
		password: {},
	};
	const kmsSecrets = {
		kms: {},
	};

	assert.equal(isS3BackendConfig(s3Backend), true);
	assert.equal(isLocalBackendConfig(localBackend), true);
	assert.equal(isPasswordSecretsConfig(passwordSecrets), true);
	assert.equal(isKmsSecretsConfig(kmsSecrets), true);
});
