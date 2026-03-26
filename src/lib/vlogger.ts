import { getLogger, type Logger } from '@logtape/logtape';

export interface VLogger {
	error(message: string): void;
	info(message: string): void;
	warn(message: string): void;
	warning(message: string): void;
}

export type VLoggerFactory = (category: readonly string[]) => VLogger;

export class VlogManager {
	factory: VLoggerFactory;

	constructor(factory: VLoggerFactory = defaultLoggerFactory) {
		this.factory = factory;
	}

	getLogger(category: readonly string[]): VLogger {
		return this.factory(category);
	}

	resetFactory(): void {
		this.factory = defaultLoggerFactory;
	}

	setFactory(factory: VLoggerFactory): void {
		this.factory = factory;
	}
}

export const vlogManager = new VlogManager();

function defaultLoggerFactory(category: readonly string[]): VLogger {
	return getLogger(category) as Logger;
}
