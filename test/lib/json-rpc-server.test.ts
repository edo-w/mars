import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { JsonRpcServer } from '#src/lib/json-rpc-server';
import { MessageEnvelope } from '#src/lib/json-rpc-shapes';

async function createSocketPath(): Promise<string> {
	if (process.platform === 'win32') {
		return `\\\\.\\pipe\\mars-json-rpc-server-${crypto.randomUUID()}`;
	}

	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-json-rpc-server-'));

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

test('JsonRpcServer emits message events and responds on the same socket', async () => {
	const socketPath = await createSocketPath();
	const server = new JsonRpcServer(socketPath);
	let socketId = -1;
	let envelopeId = -1;
	let message: Record<string, unknown> | null = null;

	server.onMessage((event) => {
		socketId = event.socket_id;
		envelopeId = event.envelope_id;
		message = event.message;
		void server.respond(event.socket_id, event.envelope_id, {
			ok: true,
			type: 'ping',
		});
	});

	try {
		await server.listen();

		const response = await new Promise<MessageEnvelope>((resolve, reject) => {
			const socket = net.createConnection(socketPath);

			socket.once('connect', () => {
				const request = new MessageEnvelope({
					id: 7,
					message: {
						token: 'token',
						type: 'ping',
					},
				});

				socket.write(`${JSON.stringify(request)}\n`);
			});
			socket.once('data', (chunk) => {
				try {
					const responseText = chunk.toString('utf8').trim();
					const envelope = new MessageEnvelope(JSON.parse(responseText) as unknown);

					resolve(envelope);
				} catch (error) {
					reject(error);
				} finally {
					socket.end();
				}
			});
			socket.once('error', reject);
		});

		assert.equal(socketId > 0, true);
		assert.equal(envelopeId, 7);
		assert.deepEqual(message, {
			token: 'token',
			type: 'ping',
		});
		assert.equal(response.id, 7);
		assert.deepEqual(response.message, {
			ok: true,
			type: 'ping',
		});
	} finally {
		await server.close();
		await removeSocketDir(socketPath);
	}
});

test('JsonRpcServer emits an error event for invalid JSON input', async () => {
	const socketPath = await createSocketPath();
	const server = new JsonRpcServer(socketPath);
	const errorEventPromise = new Promise<unknown>((resolve) => {
		server.onError((event) => {
			resolve(event);
		});
	});

	try {
		await server.listen();

		await new Promise<void>((resolve, reject) => {
			const socket = net.createConnection(socketPath);

			socket.once('connect', () => {
				socket.write('not-json\n');
			});
			socket.once('error', reject);
			setTimeout(() => {
				socket.end();
				resolve();
			}, 10);
		});
		const errorEvent = await errorEventPromise;

		assert.notEqual(errorEvent, null);

		if (errorEvent === null) {
			throw new Error('expected json-rpc error event');
		}

		const event = errorEvent as { socket_id: number | null };

		assert.equal(typeof event.socket_id, 'number');
	} finally {
		await server.close();
		await removeSocketDir(socketPath);
	}
});

test('JsonRpcServer respond rejects when the socket id is missing', async () => {
	const socketPath = await createSocketPath();
	const server = new JsonRpcServer(socketPath);

	try {
		await assert.rejects(async () => {
			await server.respond(123, 1, {
				ok: true,
				type: 'ping',
			});
		}, /json-rpc socket 123 not found/);
	} finally {
		await server.close();
		await removeSocketDir(socketPath);
	}
});

test('JsonRpcServer close succeeds before listen is called', async () => {
	const socketPath = await createSocketPath();
	const server = new JsonRpcServer(socketPath);

	try {
		await server.close();

		assert.ok(true);
	} finally {
		await removeSocketDir(socketPath);
	}
});
