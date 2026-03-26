import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { KeyAgentClient } from '#src/cli/app/key-agent/key-agent-client';
import { KeyAgentServer } from '#src/cli/app/key-agent/key-agent-server';
import {
	KeyAgentDecryptResponse,
	KeyAgentEncryptResponse,
	KeyAgentPingResponse,
	KeyAgentShutdownResponse,
} from '#src/cli/app/key-agent/key-agent-shapes';
import type { KeyAgentState } from '#src/cli/app/state/state-shapes';

async function waitFor<T>(read: () => T | null, timeoutMs = 5000): Promise<T> {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		const value = read();

		if (value !== null) {
			return value;
		}

		await new Promise((resolve) => {
			setTimeout(resolve, 10);
		});
	}

	throw new Error('timeout waiting for value');
}

function sut() {
	let currentKeyAgent: KeyAgentState | null = null;
	const clearKeyAgentIfMatches = vi.fn(async (pid: number, token: string) => {
		const matches = currentKeyAgent !== null && currentKeyAgent.pid === pid && currentKeyAgent.token === token;

		if (matches) {
			currentKeyAgent = null;
		}
	});
	const setKeyAgent = vi.fn(async (keyAgent: KeyAgentState | null) => {
		currentKeyAgent = keyAgent;
	});
	const stateService = {
		clearKeyAgentIfMatches,
		setKeyAgent,
	};
	const keyAgentService = {
		decrypt: vi.fn((_request) => {
			return new KeyAgentDecryptResponse({
				ok: true,
				plaintext: 'aGVsbG8=',
				type: 'decrypt',
			});
		}),
		encrypt: vi.fn((_request) => {
			return new KeyAgentEncryptResponse({
				encrypted_secret: {
					algorithm: 'AES-GCM',
					ciphertext: 'Y2lwaGVydGV4dA==',
					iv: 'aXZ2aXZ2aXZ2aXY=',
				},
				ok: true,
				type: 'encrypt',
			});
		}),
		ping: vi.fn((_request) => {
			return new KeyAgentPingResponse({
				ok: true,
				type: 'ping',
			});
		}),
		shutdown: vi.fn((_request) => {
			return new KeyAgentShutdownResponse({
				ok: true,
				type: 'shutdown',
			});
		}),
	};
	const server = new KeyAgentServer(stateService as never, keyAgentService as never);

	return {
		clearKeyAgentIfMatches,
		getCurrentKeyAgent() {
			return currentKeyAgent;
		},
		keyAgentService,
		server,
		setKeyAgent,
	};
}

test('KeyAgentServer serves ping and shutdown requests over the key-agent socket', async () => {
	const { clearKeyAgentIfMatches, getCurrentKeyAgent, keyAgentService, server, setKeyAgent } = sut();
	const servePromise = server.serveAndWaitForClose();
	const keyAgent = await waitFor(() => {
		return getCurrentKeyAgent();
	});
	const client = new KeyAgentClient(keyAgent.socket);

	try {
		const pingResponse = await client.ping({
			token: keyAgent.token,
			type: 'ping',
		});
		const shutdownResponse = await client.shutdown({
			token: keyAgent.token,
			type: 'shutdown',
		});

		assert.equal(pingResponse.type, 'ping');
		assert.equal(shutdownResponse.type, 'shutdown');
		assert.equal(keyAgentService.ping.mock.calls.length, 1);
		assert.equal(keyAgentService.shutdown.mock.calls.length, 1);
	} finally {
		await servePromise;
		await client.close();
	}

	assert.equal(setKeyAgent.mock.calls.length, 1);
	assert.equal(clearKeyAgentIfMatches.mock.calls.length, 1);
});
