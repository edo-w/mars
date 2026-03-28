import net from 'node:net';
import { MessageEnvelope } from '#src/lib/json-rpc/json-rpc-shapes';
import { PromiseSignal } from '#src/lib/promise-signal';
import type { VLogger } from '#src/lib/vlogger';
import { vlogManager } from '#src/lib/vlogger';

const JSON_RPC_REQUEST_TIMEOUT_MS = 5 * 1000;

interface PendingRequest {
	response: Record<string, unknown> | null;
	signal: PromiseSignal;
	timeout: NodeJS.Timeout;
}

export class JsonRpcClient {
	closeByClient: boolean;
	dataBuffer: string;
	keepAlive: boolean;
	logger: VLogger;
	nextId: number;
	pending: Map<number, PendingRequest>;
	socket: net.Socket | null;
	socketPath: string;
	socketPromise: Promise<net.Socket> | null;

	constructor(socketPath: string) {
		this.closeByClient = false;
		this.dataBuffer = '';
		this.keepAlive = false;
		this.logger = vlogManager.getLogger(['mars', 'json-rpc', 'client']);
		this.nextId = 1;
		this.pending = new Map();
		this.socket = null;
		this.socketPath = socketPath;
		this.socketPromise = null;
	}

	async close(): Promise<void> {
		this.closeByClient = true;
		this.clearPending(new Error('json-rpc client closed'));

		if (this.socket === null) {
			return;
		}

		const socket = this.socket;

		this.socket = null;
		this.socketPromise = null;
		this.dataBuffer = '';
		await new Promise<void>((resolve) => {
			socket.end(() => {
				resolve();
			});
		});
	}

	async send(message: object): Promise<Record<string, unknown>> {
		const socket = await this.ensureConnected();
		const id = this.nextId;
		const signal = new PromiseSignal();
		const timeout = setTimeout(() => {
			this.pending.delete(id);
			signal.reject(new Error('json-rpc request timeout'));
		}, JSON_RPC_REQUEST_TIMEOUT_MS);
		const pendingRequest: PendingRequest = {
			response: null,
			signal,
			timeout,
		};
		const envelope = new MessageEnvelope({
			id,
			message,
		});

		this.nextId += 1;
		this.pending.set(id, pendingRequest);
		socket.write(`${JSON.stringify(envelope)}\n`);
		try {
			await pendingRequest.signal.wait();
			const response = pendingRequest.response;

			if (response === null) {
				throw new Error('json-rpc response missing');
			}

			return response;
		} finally {
			if (!this.keepAlive) {
				await this.close();
			}
		}
	}

	setKeepAlive(keepAlive: boolean): void {
		this.keepAlive = keepAlive;
	}

	private clearPending(error: Error): void {
		for (const [id, pendingRequest] of this.pending) {
			clearTimeout(pendingRequest.timeout);
			pendingRequest.signal.reject(error);
			this.pending.delete(id);
		}
	}

	private async ensureConnected(): Promise<net.Socket> {
		if (this.socket !== null) {
			return this.socket;
		}

		if (this.socketPromise !== null) {
			return this.socketPromise;
		}

		this.socketPromise = new Promise<net.Socket>((resolve, reject) => {
			const socket = net.createConnection(this.socketPath);

			socket.once('connect', () => {
				this.closeByClient = false;
				this.socket = socket;
				this.socketPromise = null;
				this.bindSocket(socket);
				resolve(socket);
			});
			socket.once('error', (error) => {
				this.socketPromise = null;
				reject(error);
			});
		});

		return this.socketPromise;
	}

	private bindSocket(socket: net.Socket): void {
		socket.on('close', () => {
			this.handleSocketClose();
		});
		socket.on('data', (chunk) => {
			try {
				this.handleSocketData(chunk);
			} catch (error) {
				this.logger.error(`json-rpc client socket data error: ${String(error)}`);

				if (this.socket !== null) {
					this.socket.destroy();
				}
			}
		});
		socket.on('error', (error) => {
			this.handleSocketError(error);
		});
	}

	private handleSocketClose(): void {
		const closeByClient = this.closeByClient;

		this.socket = null;
		this.socketPromise = null;
		this.dataBuffer = '';
		this.closeByClient = false;

		if (closeByClient) {
			return;
		}

		this.clearPending(new Error('json-rpc socket closed'));
	}

	private handleSocketData(chunk: Buffer | string): void {
		this.dataBuffer += chunk.toString('utf8');
		this.processData();
	}

	private handleSocketError(error: Error): void {
		this.logger.error(`json-rpc client socket error: ${String(error)}`);
		this.clearPending(error);

		if (this.socket !== null) {
			this.socket.destroy();
		}
	}

	private processData(): void {
		while (this.dataBuffer.includes('\n')) {
			const newlineIndex = this.dataBuffer.indexOf('\n');
			const messageText = this.dataBuffer.slice(0, newlineIndex).trim();

			this.dataBuffer = this.dataBuffer.slice(newlineIndex + 1);

			if (messageText.length === 0) {
				continue;
			}

			const messageFields = JSON.parse(messageText) as unknown;
			const envelope = new MessageEnvelope(messageFields);
			const pendingRequest = this.pending.get(envelope.id);

			if (pendingRequest === undefined) {
				continue;
			}

			clearTimeout(pendingRequest.timeout);
			this.pending.delete(envelope.id);
			pendingRequest.response = envelope.message;
			pendingRequest.signal.resolve();
		}
	}
}
