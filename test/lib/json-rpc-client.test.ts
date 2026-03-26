import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { JsonRpcClient } from '#src/lib/json-rpc-client';
import { MessageEnvelope } from '#src/lib/json-rpc-shapes';

async function createSocketPath(): Promise<string> {
	if (process.platform === 'win32') {
		return `\\\\.\\pipe\\mars-json-rpc-${crypto.randomUUID()}`;
	}

	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-json-rpc-'));

	return path.join(tempDir, 'json-rpc.sock');
}

async function removeSocketDir(socketPath: string): Promise<void> {
	if (process.platform === 'win32') {
		return;
	}

	const directoryPath = path.dirname(socketPath);

	await fsp.rm(directoryPath, {
		force: true,
		recursive: true,
	});
}

test('JsonRpcClient send returns the response message', async () => {
	const socketPath = await createSocketPath();
	const server = net.createServer((socket) => {
		socket.once('data', (chunk) => {
			const messageText = chunk.toString('utf8').trim();
			const envelope = new MessageEnvelope(JSON.parse(messageText) as unknown);
			const response = new MessageEnvelope({
				id: envelope.id,
				message: {
					ok: true,
					type: 'ping',
				},
			});

			socket.write(`${JSON.stringify(response)}\n`);
		});
	});

	try {
		await new Promise<void>((resolve, reject) => {
			server.listen(socketPath, () => {
				resolve();
			});
			server.once('error', reject);
		});

		const client = new JsonRpcClient(socketPath);
		const response = await client.send({
			token: 'token',
			type: 'ping',
		});

		assert.deepEqual(response, {
			ok: true,
			type: 'ping',
		});
		await client.close();
	} finally {
		server.close();
		await removeSocketDir(socketPath);
	}
});

test('JsonRpcClient rejects pending requests when the socket closes', async () => {
	const socketPath = await createSocketPath();
	const server = net.createServer((socket) => {
		socket.once('data', () => {
			socket.destroy();
		});
	});

	try {
		await new Promise<void>((resolve, reject) => {
			server.listen(socketPath, () => {
				resolve();
			});
			server.once('error', reject);
		});

		const client = new JsonRpcClient(socketPath);

		await assert.rejects(async () => {
			await client.send({
				token: 'token',
				type: 'ping',
			});
		}, /json-rpc socket closed/);

		await client.close();
	} finally {
		server.close();
		await removeSocketDir(socketPath);
	}
});

test('JsonRpcClient close succeeds when no socket was created', async () => {
	const client = new JsonRpcClient('/tmp/mars-missing.sock');

	await client.close();

	assert.ok(true);
});
