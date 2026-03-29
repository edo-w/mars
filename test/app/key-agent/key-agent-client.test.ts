import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { KeyAgentClient } from '#src/app/key-agent/key-agent-client';
import {
	KeyAgentDecryptRequest,
	KeyAgentEncryptRequest,
	KeyAgentPingRequest,
	KeyAgentShutdownRequest,
} from '#src/app/key-agent/key-agent-shapes';

function sut() {
	const client = new KeyAgentClient('/tmp/mars.sock');

	return {
		client,
	};
}

test('KeyAgentClient closes the underlying json-rpc client', async () => {
	const { client } = sut();
	const close = vi.fn(async () => {});

	client.jsonRpcClient.close = close;
	await client.close();

	assert.equal(close.mock.calls.length, 1);
});

test('KeyAgentClient ping returns a ping response for a valid message', async () => {
	const { client } = sut();
	const request = new KeyAgentPingRequest({
		token: 'token',
		type: 'ping',
	});

	client.jsonRpcClient.send = vi.fn(async () => {
		return {
			ok: true,
			type: 'ping',
		};
	});

	const response = await client.ping(request);

	assert.equal(response.type, 'ping');
});

test('KeyAgentClient ping throws when the response is invalid', async () => {
	const { client } = sut();
	const request = new KeyAgentPingRequest({
		token: 'token',
		type: 'ping',
	});

	client.jsonRpcClient.send = vi.fn(async () => {
		return {
			type: 'ping',
		};
	});

	await assert.rejects(async () => {
		await client.ping(request);
	}, /invalid ping response/);
});

test('KeyAgentClient ping throws the server error response', async () => {
	const { client } = sut();
	const request = new KeyAgentPingRequest({
		token: 'token',
		type: 'ping',
	});

	client.jsonRpcClient.send = vi.fn(async () => {
		return {
			error: 'boom',
			ok: false,
			type: 'ping',
		};
	});

	await assert.rejects(async () => {
		await client.ping(request);
	}, /boom/);
});

test('KeyAgentClient encrypt returns an encrypt response for a valid message', async () => {
	const { client } = sut();
	const request = new KeyAgentEncryptRequest({
		environment: 'gl-dev',
		plaintext: 'cGxhaW50ZXh0',
		token: 'token',
		type: 'encrypt',
	});

	client.jsonRpcClient.send = vi.fn(async () => {
		return {
			encrypted_secret: {
				algorithm: 'AES-GCM',
				ciphertext: 'ciphertext',
				iv: 'iv',
			},
			ok: true,
			type: 'encrypt',
		};
	});

	const response = await client.encrypt(request);

	assert.equal(response.type, 'encrypt');
	assert.equal(response.encrypted_secret.ciphertext, 'ciphertext');
});

test('KeyAgentClient decrypt returns a decrypt response for a valid message', async () => {
	const { client } = sut();
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

	client.jsonRpcClient.send = vi.fn(async () => {
		return {
			ok: true,
			plaintext: 'cGxhaW50ZXh0',
			type: 'decrypt',
		};
	});

	const response = await client.decrypt(request);

	assert.equal(response.type, 'decrypt');
	assert.equal(response.plaintext, 'cGxhaW50ZXh0');
});

test('KeyAgentClient shutdown returns a shutdown response for a valid message', async () => {
	const { client } = sut();
	const request = new KeyAgentShutdownRequest({
		token: 'token',
		type: 'shutdown',
	});

	client.jsonRpcClient.send = vi.fn(async () => {
		return {
			ok: true,
			type: 'shutdown',
		};
	});

	const response = await client.shutdown(request);

	assert.equal(response.type, 'shutdown');
});
