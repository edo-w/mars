import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
	KeyAgentDecryptRequest,
	KeyAgentDecryptResponse,
	KeyAgentEncryptRequest,
	KeyAgentEncryptResponse,
	KeyAgentErrorResponse,
	KeyAgentPingRequest,
	KeyAgentPingResponse,
	KeyAgentShutdownRequest,
	KeyAgentShutdownResponse,
} from '#src/cli/app/key-agent/key-agent-shapes';

test('KeyAgentPingRequest constructs from valid input', () => {
	const request = new KeyAgentPingRequest({
		token: 'token',
		type: 'ping',
	});

	assert.equal(request.type, 'ping');
});

test('KeyAgentPingRequest rejects invalid input', () => {
	assert.throws(() => {
		return new KeyAgentPingRequest({
			token: '',
			type: 'ping',
		});
	});
});

test('KeyAgentEncryptRequest constructs from valid input', () => {
	const request = new KeyAgentEncryptRequest({
		environment: 'gl-dev',
		plaintext: 'cGxhaW50ZXh0',
		token: 'token',
		type: 'encrypt',
	});

	assert.equal(request.type, 'encrypt');
});

test('KeyAgentEncryptRequest rejects invalid input', () => {
	assert.throws(() => {
		return new KeyAgentEncryptRequest({
			environment: '',
			plaintext: 'cGxhaW50ZXh0',
			token: 'token',
			type: 'encrypt',
		});
	});
});

test('KeyAgentDecryptRequest constructs from valid input', () => {
	const request = new KeyAgentDecryptRequest({
		encrypted_secret: {
			algorithm: 'AES-GCM',
			ciphertext: 'ciphertext',
			iv: 'iv',
		},
		environment: 'gl-dev',
		token: 'token',
		type: 'decrypt',
	});

	assert.equal(request.type, 'decrypt');
});

test('KeyAgentDecryptRequest rejects invalid input', () => {
	assert.throws(() => {
		return new KeyAgentDecryptRequest({
			encrypted_secret: {
				algorithm: 'AES-GCM',
				ciphertext: '',
				iv: 'iv',
			},
			environment: 'gl-dev',
			token: 'token',
			type: 'decrypt',
		});
	});
});

test('KeyAgentShutdownRequest constructs from valid input', () => {
	const request = new KeyAgentShutdownRequest({
		token: 'token',
		type: 'shutdown',
	});

	assert.equal(request.type, 'shutdown');
});

test('KeyAgentShutdownRequest rejects invalid input', () => {
	assert.throws(() => {
		return new KeyAgentShutdownRequest({
			token: '',
			type: 'shutdown',
		});
	});
});

test('KeyAgentPingResponse constructs from valid input', () => {
	const response = new KeyAgentPingResponse({
		ok: true,
		type: 'ping',
	});

	assert.equal(response.type, 'ping');
});

test('KeyAgentPingResponse rejects invalid input', () => {
	assert.throws(() => {
		return new KeyAgentPingResponse({
			ok: false,
			type: 'ping',
		});
	});
});

test('KeyAgentEncryptResponse constructs from valid input', () => {
	const response = new KeyAgentEncryptResponse({
		encrypted_secret: {
			algorithm: 'AES-GCM',
			ciphertext: 'ciphertext',
			iv: 'iv',
		},
		ok: true,
		type: 'encrypt',
	});

	assert.equal(response.type, 'encrypt');
});

test('KeyAgentEncryptResponse rejects invalid input', () => {
	assert.throws(() => {
		return new KeyAgentEncryptResponse({
			encrypted_secret: {
				algorithm: 'AES-GCM',
				ciphertext: '',
				iv: 'iv',
			},
			ok: true,
			type: 'encrypt',
		});
	});
});

test('KeyAgentDecryptResponse constructs from valid input', () => {
	const response = new KeyAgentDecryptResponse({
		ok: true,
		plaintext: 'cGxhaW50ZXh0',
		type: 'decrypt',
	});

	assert.equal(response.type, 'decrypt');
});

test('KeyAgentDecryptResponse rejects invalid input', () => {
	assert.throws(() => {
		return new KeyAgentDecryptResponse({
			ok: true,
			plaintext: '',
			type: 'decrypt',
		});
	});
});

test('KeyAgentShutdownResponse constructs from valid input', () => {
	const response = new KeyAgentShutdownResponse({
		ok: true,
		type: 'shutdown',
	});

	assert.equal(response.type, 'shutdown');
});

test('KeyAgentShutdownResponse rejects invalid input', () => {
	assert.throws(() => {
		return new KeyAgentShutdownResponse({
			ok: false,
			type: 'shutdown',
		});
	});
});

test('KeyAgentErrorResponse constructs from valid input', () => {
	const response = new KeyAgentErrorResponse({
		error: 'boom',
		ok: false,
		type: 'encrypt',
	});

	assert.equal(response.type, 'encrypt');
});

test('KeyAgentErrorResponse rejects invalid input', () => {
	assert.throws(() => {
		return new KeyAgentErrorResponse({
			error: '',
			ok: false,
			type: 'encrypt',
		});
	});
});
