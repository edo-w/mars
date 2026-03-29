import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { KeyAgentClient } from '#src/app/key-agent/key-agent-client';
import type { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import { KeyAgentDecryptResponse, KeyAgentEncryptResponse } from '#src/app/key-agent/key-agent-shapes';
import { KeyAgentSecretsService } from '#src/app/secrets/key-agent-secrets-service';
import type { StateService } from '#src/app/state/state-service';
import type { PublicLike } from '#src/lib/types';

type KeyAgentManagerLike = PublicLike<KeyAgentManager>;

function sut() {
	const keyAgentManager = new MockKeyAgentManager();
	const service = new KeyAgentSecretsService(keyAgentManager as unknown as KeyAgentManager);

	return {
		keyAgentManager,
		service,
	};
}

test('KeyAgentSecretsService uses the key-agent client for encrypt and decrypt', async () => {
	const { keyAgentManager, service } = sut();
	const environment = {
		config: {
			aws_account_id: '10000',
			aws_region: 'us-east-1',
			id: 'gl-dev',
			name: 'dev',
			namespace: 'gl',
		},
		configPath: 'infra/envs/dev/environment.yml',
		directoryPath: 'infra/envs/dev',
		id: 'gl-dev',
		selected: false,
	};
	const clientDecrypt = vi.spyOn(KeyAgentClient.prototype, 'decrypt').mockResolvedValue(
		new KeyAgentDecryptResponse({
			ok: true,
			plaintext: Buffer.from('mars secret', 'utf8').toString('base64'),
			type: 'decrypt',
		}),
	);
	const clientEncrypt = vi.spyOn(KeyAgentClient.prototype, 'encrypt').mockResolvedValue(
		new KeyAgentEncryptResponse({
			encrypted_secret: {
				algorithm: 'AES-GCM',
				ciphertext: 'ciphertext',
				iv: 'iv',
			},
			ok: true,
			type: 'encrypt',
		}),
	);

	const encryptedSecret = await service.encryptText(environment, 'mars secret');
	const plaintext = await service.decryptText(environment, encryptedSecret);
	const ensureRunningCalls = keyAgentManager.ensureRunningCalls.length;

	assert.equal(ensureRunningCalls, 2);
	assert.equal(clientEncrypt.mock.calls.length, 1);
	assert.equal(clientDecrypt.mock.calls.length, 1);
	assert.equal(plaintext, 'mars secret');
});

class MockKeyAgentManager implements KeyAgentManagerLike {
	ensureRunningCalls: string[];
	stateService: StateService;

	constructor() {
		this.ensureRunningCalls = [];
		this.stateService = null as unknown as StateService;
	}

	async ensureRunning() {
		this.ensureRunningCalls.push('ensureRunning');

		return {
			pid: 123,
			socket: '/tmp/mars.sock',
			token: 'token',
		};
	}

	async show() {
		return {
			kind: 'stopped' as const,
		};
	}

	async ping() {
		return {
			kind: 'not_running' as const,
		};
	}

	async start() {
		return {
			kind: 'timeout' as const,
		};
	}

	async stop() {
		return {
			kind: 'not_running' as const,
		};
	}
}
