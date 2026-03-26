import assert from 'node:assert/strict';
import os from 'node:os';
import { test, vi } from 'vitest';
import {
	createKeyAgentState,
	createSocketPath,
	isRequestMessage,
	isResponseMessage,
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

function withPlatform(platform: NodeJS.Platform, callback: () => void) {
	const originalPlatform = process.platform;

	Object.defineProperty(process, 'platform', {
		value: platform,
	});

	try {
		callback();
	} finally {
		Object.defineProperty(process, 'platform', {
			value: originalPlatform,
		});
	}
}

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

test('createKeyAgentState builds a key-agent state with generated values', () => {
	const originalRandomUuid = crypto.randomUUID;
	let callCount = 0;

	crypto.randomUUID = () => {
		callCount += 1;

		return callCount === 1 ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222';
	};

	try {
		const keyAgentState = createKeyAgentState(123);

		assert.equal(keyAgentState.pid, 123);
		assert.equal(keyAgentState.token, '11111111-1111-1111-1111-111111111111');
		assert.equal(keyAgentState.socket, '\\\\.\\pipe\\mars-key-agent-22222222-2222-2222-2222-222222222222');
	} finally {
		crypto.randomUUID = originalRandomUuid;
	}
});

test('createSocketPath builds a Windows named pipe path', () => {
	withPlatform('win32', () => {
		const socketPath = createSocketPath('abc');

		assert.equal(socketPath, '\\\\.\\pipe\\mars-key-agent-abc');
	});
});

test('createSocketPath builds a Unix socket path', () => {
	withPlatform('linux', () => {
		const tmpdir = vi.spyOn(os, 'tmpdir').mockReturnValue('/tmp');

		try {
			const socketPath = createSocketPath('abc');

			assert.equal(socketPath, '/tmp/mars-key-agent-abc.sock');
		} finally {
			tmpdir.mockRestore();
		}
	});
});

test('isRequestMessage returns true for a valid request message', () => {
	const requestMessage = {
		token: 'token',
		type: 'ping',
	};
	const result = isRequestMessage(requestMessage);

	assert.equal(result, true);
});

test('isRequestMessage returns false for an invalid request message', () => {
	const requestMessage = {
		type: 'ping',
	};
	const result = isRequestMessage(requestMessage);

	assert.equal(result, false);
});

test('isResponseMessage returns true for an ok response message', () => {
	const responseMessage = {
		ok: true,
		type: 'ping',
	};
	const result = isResponseMessage(responseMessage);

	assert.equal(result, true);
});

test('isResponseMessage returns true for an error response message', () => {
	const responseMessage = {
		error: 'boom',
		ok: false,
		type: 'ping',
	};
	const result = isResponseMessage(responseMessage);

	assert.equal(result, true);
});

test('isResponseMessage returns false when an error response is missing the error text', () => {
	const responseMessage = {
		ok: false,
		type: 'ping',
	};
	const result = isResponseMessage(responseMessage);

	assert.equal(result, false);
});
