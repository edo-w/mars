import net from 'node:net';
import { getLogger, type Logger } from '@logtape/logtape';
import { MessageEnvelope } from '#src/lib/json-rpc-shapes';
import { PromiseSignal } from '#src/lib/promise-signal';

const JSON_RPC_IDLE_TIMEOUT_MS = 30 * 1000;
const JSON_RPC_REQUEST_TIMEOUT_MS = 5 * 1000;

interface PendingRequest {
	response: Record<string, unknown> | null;
	signal: PromiseSignal;
	timeout: NodeJS.Timeout;
}

export class JsonRpcClient {
	dataBuffer: string;
	idleTimer: NodeJS.Timeout | null;
	logger: Logger;
	nextId: number;
	pending: Map<number, PendingRequest>;
	socket: net.Socket | null;
	socketPath: string;
	socketPromise: Promise<net.Socket> | null;

	constructor(socketPath: string) {
		this.dataBuffer = '';
		this.idleTimer = null;
		this.logger = getLogger(['mars', 'json-rpc', 'client']);
		this.nextId = 1;
		this.pending = new Map();
		this.socket = null;
		this.socketPath = socketPath;
		this.socketPromise = null;
	}

	async close(): Promise<void> {
		this.clearIdleTimer();
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
		this.resetIdleTimer();
		socket.write(`${JSON.stringify(envelope)}\n`);
		await pendingRequest.signal.wait();
		this.resetIdleTimer();
		const response = pendingRequest.response;

		if (response === null) {
			throw new Error('json-rpc response missing');
		}

		return response;
	}

	private clearIdleTimer(): void {
		if (this.idleTimer === null) {
			return;
		}

		clearTimeout(this.idleTimer);
		this.idleTimer = null;
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
		this.socket = null;
		this.socketPromise = null;
		this.dataBuffer = '';
		this.clearIdleTimer();
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

	private resetIdleTimer(): void {
		this.clearIdleTimer();
		this.idleTimer = setTimeout(() => {
			void this.close();
		}, JSON_RPC_IDLE_TIMEOUT_MS);
	}
}
