import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { type Environment, EnvironmentConfig } from '#src/cli/app/environment/environment-shapes';
import { KeyAgentService } from '#src/cli/app/key-agent/key-agent-service';
import {
	KeyAgentDecryptRequest,
	KeyAgentEncryptRequest,
	KeyAgentPingRequest,
	KeyAgentShutdownRequest,
} from '#src/cli/app/key-agent/key-agent-shapes';
import { EncryptedSecretRecord } from '#src/cli/app/secrets/secrets-shapes';

function createEnvironment(): Environment {
	const config = new EnvironmentConfig({
		aws_account_id: '123',
		aws_region: 'us-east-1',
		name: 'dev',
		namespace: 'gl',
	});

	return {
		config,
		configPath: 'infra/envs/dev/environment.yml',
		directoryPath: 'infra/envs/dev',
		id: config.id,
		selected: false,
	};
}

function sut() {
	const environment = createEnvironment();
	const get = vi.fn(async (name: string) => {
		return name === environment.id ? environment : null;
	});
	const getDataKey = vi.fn(async () => {
		return new Uint8Array(32).fill(7);
	});
	const create = vi.fn(async () => {
		return {
			getDataKey,
		};
	});
	const environmentService = {
		get,
	};
	const secretsProviderFactory = {
		create,
	};
	const service = new KeyAgentService(environmentService as never, secretsProviderFactory as never);

	return {
		create,
		environment,
		get,
		getDataKey,
		service,
	};
}

test('KeyAgentService ping returns a ping response', () => {
	const { service } = sut();
	const response = service.ping(
		new KeyAgentPingRequest({
			token: 'token',
			type: 'ping',
		}),
	);

	assert.equal(response.type, 'ping');
});

test('KeyAgentService shutdown returns a shutdown response', () => {
	const { service } = sut();
	const response = service.shutdown(
		new KeyAgentShutdownRequest({
			token: 'token',
			type: 'shutdown',
		}),
	);

	assert.equal(response.type, 'shutdown');
});

test('KeyAgentService encrypt and decrypt round trip text for an environment', async () => {
	const { environment, service } = sut();
	const encryptRequest = new KeyAgentEncryptRequest({
		environment: environment.id,
		plaintext: 'aGVsbG8=',
		token: 'token',
		type: 'encrypt',
	});
	const encryptResponse = await service.encrypt(encryptRequest);
	const decryptRequest = new KeyAgentDecryptRequest({
		encrypted_secret: encryptResponse.encrypted_secret,
		environment: environment.id,
		token: 'token',
		type: 'decrypt',
	});
	const decryptResponse = await service.decrypt(decryptRequest);

	assert.equal(decryptResponse.plaintext, 'aGVsbG8=');
});

test('KeyAgentService caches the data key for repeated environment operations', async () => {
	const { environment, getDataKey, service } = sut();
	const encryptRequest = new KeyAgentEncryptRequest({
		environment: environment.id,
		plaintext: 'aGVsbG8=',
		token: 'token',
		type: 'encrypt',
	});
	const encryptedSecret = new EncryptedSecretRecord({
		algorithm: 'AES-GCM',
		ciphertext: 'Y2lwaGVydGV4dA==',
		iv: 'aXZ2aXZ2aXZ2aXY=',
	});

	await service.encrypt(encryptRequest).catch(() => {});
	await service
		.decrypt(
			new KeyAgentDecryptRequest({
				encrypted_secret: encryptedSecret,
				environment: environment.id,
				token: 'token',
				type: 'decrypt',
			}),
		)
		.catch(() => {});

	assert.equal(getDataKey.mock.calls.length, 1);
});

test('KeyAgentService throws when encrypting for a missing environment', async () => {
	const { service } = sut();

	await assert.rejects(async () => {
		await service.encrypt(
			new KeyAgentEncryptRequest({
				environment: 'gl-missing',
				plaintext: 'aGVsbG8=',
				token: 'token',
				type: 'encrypt',
			}),
		);
	}, /environment "gl-missing" not found/);
});
