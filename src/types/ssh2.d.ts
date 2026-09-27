declare module 'ssh2' {
	import { EventEmitter } from 'node:events';

	export interface ConnectConfig {
		host: string;
		port: number;
		privateKey: Buffer | string;
		readyTimeout?: number;
		username: string;
	}

	export interface ClientChannelStderr extends EventEmitter {
		on(event: 'data', listener: (data: Buffer | string) => void): this;
	}

	export interface ClientChannel extends EventEmitter {
		stderr: ClientChannelStderr;

		close(): void;
		on(event: 'close', listener: (code: number | null, signal?: string) => void): this;
		on(event: 'data', listener: (data: Buffer | string) => void): this;
		once(event: 'error', listener: (error: Error) => void): this;
	}

	export class Client extends EventEmitter {
		connect(config: ConnectConfig): this;
		end(): void;
		exec(command: string, callback: (error: Error | undefined, channel: ClientChannel) => void): void;
		once(event: 'ready', listener: () => void): this;
		once(event: 'error', listener: (error: Error) => void): this;
		once(event: 'close', listener: () => void): this;
	}
}
