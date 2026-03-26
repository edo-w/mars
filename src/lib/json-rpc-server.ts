import { EventEmitter } from 'node:events';
import net from 'node:net';
import {
	type JsonRpcServerErrorEvent,
	type JsonRpcServerMessageEvent,
	MessageEnvelope,
} from '#src/lib/json-rpc-shapes';
import type { VLogger } from '#src/lib/vlogger';
import { vlogManager } from '#src/lib/vlogger';

export class JsonRpcServer {
	dataBuffers: Map<number, string>;
	emitter: EventEmitter;
	logger: VLogger;
	nextSocketId: number;
	server: net.Server | null;
	socketIds: Map<net.Socket, number>;
	socketPath: string;
	sockets: Map<number, net.Socket>;

	constructor(socketPath: string) {
		this.dataBuffers = new Map();
		this.emitter = new EventEmitter();
		this.logger = vlogManager.getLogger(['mars', 'json-rpc', 'server']);
		this.nextSocketId = 1;
		this.server = null;
		this.socketIds = new Map();
		this.socketPath = socketPath;
		this.sockets = new Map();
	}

	async close(): Promise<void> {
		const server = this.server;

		if (server === null) {
			return;
		}

		this.closeSockets();
		this.dataBuffers.clear();
		await new Promise<void>((resolve) => {
			server.close(() => {
				resolve();
			});
		});
		this.server = null;
	}

	async listen(): Promise<void> {
		const server = net.createServer((socket) => {
			this.handleSocketConnection(socket);
		});

		this.server = server;
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(this.socketPath, () => {
				server.off('error', reject);
				resolve();
			});
		});
	}

	onError(handler: (event: JsonRpcServerErrorEvent) => void): void {
		this.emitter.on('error', handler);
	}

	onMessage(handler: (event: JsonRpcServerMessageEvent) => void): void {
		this.emitter.on('message', handler);
	}

	async respond(socketId: number, envelopeId: number, message: object): Promise<void> {
		const socket = this.sockets.get(socketId);

		if (socket === undefined) {
			throw new Error(`json-rpc socket ${socketId} not found`);
		}

		await this.writeEnvelope(socket, envelopeId, message);
	}

	private closeSockets(): void {
		for (const socket of this.sockets.values()) {
			socket.destroy();
		}

		this.socketIds.clear();
		this.sockets.clear();
	}

	private emitError(error: unknown, socketId: number | null): void {
		this.emitter.emit('error', {
			error,
			socket_id: socketId,
		} satisfies JsonRpcServerErrorEvent);
	}

	private handleSocketClose(socket: net.Socket): void {
		const socketId = this.socketIds.get(socket);

		if (socketId === undefined) {
			return;
		}

		this.dataBuffers.delete(socketId);
		this.socketIds.delete(socket);
		this.sockets.delete(socketId);
	}

	private handleSocketConnection(socket: net.Socket): void {
		const socketId = this.nextSocketId;

		this.nextSocketId += 1;
		this.socketIds.set(socket, socketId);
		this.sockets.set(socketId, socket);
		this.dataBuffers.set(socketId, '');
		socket.on('close', () => {
			try {
				this.handleSocketClose(socket);
			} catch (error) {
				this.emitError(error, socketId);
			}
		});
		socket.on('data', (chunk) => {
			try {
				this.handleSocketData(socketId, chunk);
			} catch (error) {
				this.emitError(error, socketId);
			}
		});
		socket.on('error', (error) => {
			try {
				this.handleSocketError(socket, socketId, error);
			} catch (nextError) {
				this.emitError(nextError, socketId);
			}
		});
	}

	private handleSocketData(socketId: number, chunk: Buffer | string): void {
		const currentBuffer = this.dataBuffers.get(socketId) ?? '';
		const nextBuffer = currentBuffer + chunk.toString('utf8');

		this.dataBuffers.set(socketId, nextBuffer);
		this.processData(socketId);
	}

	private handleSocketError(socket: net.Socket, socketId: number, error: Error): void {
		this.logger.error(`json-rpc socket error: ${String(error)}`);
		this.emitError(error, socketId);
		socket.destroy();
	}

	private processData(socketId: number): void {
		let nextBuffer = this.dataBuffers.get(socketId) ?? '';

		while (nextBuffer.includes('\n')) {
			const newlineIndex = nextBuffer.indexOf('\n');
			const messageText = nextBuffer.slice(0, newlineIndex).trim();

			nextBuffer = nextBuffer.slice(newlineIndex + 1);

			if (messageText.length === 0) {
				continue;
			}

			try {
				const messageFields = JSON.parse(messageText) as unknown;
				const envelope = new MessageEnvelope(messageFields);

				this.emitter.emit('message', {
					envelope_id: envelope.id,
					message: envelope.message,
					socket_id: socketId,
				} satisfies JsonRpcServerMessageEvent);
			} catch (error) {
				this.emitError(error, socketId);
			}
		}

		this.dataBuffers.set(socketId, nextBuffer);
	}

	private async writeEnvelope(socket: net.Socket, id: number, message: object): Promise<void> {
		const envelope = new MessageEnvelope({
			id,
			message,
		});

		await new Promise<void>((resolve, reject) => {
			socket.write(`${JSON.stringify(envelope)}\n`, (error) => {
				if (error !== null) {
					reject(error);
					return;
				}

				resolve();
			});
		});
	}
}
