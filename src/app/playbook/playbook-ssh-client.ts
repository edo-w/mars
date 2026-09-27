import type { ClientChannel } from 'ssh2';
import { Client } from 'ssh2';
import type {
	PlaybookSshClient,
	PlaybookSshConnectionOptions,
	PlaybookSshExecOptions,
	PlaybookSshExecResult,
	PlaybookSshIdentity,
} from '#src/app/playbook/playbook-models';
import { readPlaybookRunAuthKey } from '#src/app/playbook/playbook-shapes';
import type { VTimer } from '#src/lib/vtimer';
import { VTimer as RealVTimer } from '#src/lib/vtimer';

export class PlaybookSshConnectionLostError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PlaybookSshConnectionLostError';
	}
}

export class PlaybookSshClientFactory {
	vtimer: VTimer;

	constructor(vtimer: VTimer = new RealVTimer()) {
		this.vtimer = vtimer;
	}

	create(): PlaybookSshClient {
		return new Ssh2PlaybookSshClient(this.vtimer);
	}
}

export class Ssh2PlaybookSshClient implements PlaybookSshClient {
	client: Client | null;
	connected: boolean;
	vtimer: VTimer;

	constructor(vtimer: VTimer = new RealVTimer()) {
		this.client = null;
		this.connected = false;
		this.vtimer = vtimer;
	}

	async close(): Promise<void> {
		const client = this.client;

		this.client = null;
		this.connected = false;

		if (client === null) {
			return;
		}

		await new Promise<void>((resolve) => {
			client.once('close', () => {
				resolve();
			});
			client.end();
		});
	}

	isConnected(): boolean {
		return this.connected;
	}

	async connect(options: PlaybookSshConnectionOptions, identity: PlaybookSshIdentity): Promise<void> {
		await this.close();

		const client = new Client();
		const privateKey = readPlaybookRunAuthKey(identity);

		this.client = client;
		this.connected = false;

		await new Promise<void>((resolve, reject) => {
			let settled = false;

			client.once('ready', () => {
				settled = true;
				this.connected = true;
				resolve();
			});
			client.once('error', (error) => {
				if (settled) {
					return;
				}

				settled = true;
				reject(new PlaybookSshConnectionLostError(String(error)));
			});
			client.once('close', () => {
				this.connected = false;

				if (settled) {
					return;
				}

				settled = true;
				reject(new PlaybookSshConnectionLostError('ssh connection closed'));
			});

			client.connect({
				host: options.host,
				port: options.port,
				privateKey,
				readyTimeout: options.connection_timeout_ms ?? 20_000,
				username: options.user,
			});
		});
	}

	async exec(command: string, options: PlaybookSshExecOptions = {}): Promise<PlaybookSshExecResult> {
		const client = this.client;

		if (client === null || !this.connected) {
			throw new PlaybookSshConnectionLostError('ssh connection not ready');
		}

		return new Promise<PlaybookSshExecResult>((resolve, reject) => {
			let channel: ClientChannel | null = null;
			let settled = false;
			let stderr = '';
			let stdout = '';
			let timeout: NodeJS.Timeout | null = null;

			const finish = (handler: () => void): void => {
				if (settled) {
					return;
				}

				settled = true;

				if (timeout !== null) {
					this.vtimer.clearTimeout(timeout);
				}

				handler();
			};

			client.exec(command, (error, nextChannel) => {
				if (error !== undefined && error !== null) {
					finish(() => {
						reject(new PlaybookSshConnectionLostError(String(error)));
					});
					return;
				}

				channel = nextChannel;

				if (options.timeout_ms !== undefined) {
					timeout = this.vtimer.setTimeout(() => {
						channel?.close();
						finish(() => {
							reject(new Error(`ssh command timeout after ${options.timeout_ms}ms`));
						});
					}, options.timeout_ms);
				}

				channel.on('close', (code: number | null, signal?: string) => {
					finish(() => {
						resolve({
							code,
							signal: signal === undefined ? null : signal,
							stderr,
							stdout,
						});
					});
				});
				channel.on('data', (data: Buffer | string) => {
					stdout += data.toString();
				});
				channel.stderr.on('data', (data: Buffer | string) => {
					stderr += data.toString();
				});
				channel.once('error', (channelError: Error) => {
					finish(() => {
						reject(new PlaybookSshConnectionLostError(String(channelError)));
					});
				});
			});
		});
	}
}

export function isPlaybookConnectionLostError(error: unknown): error is PlaybookSshConnectionLostError {
	return error instanceof PlaybookSshConnectionLostError;
}
