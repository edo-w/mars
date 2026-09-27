import type { PublicLike } from '#src/lib/types';
import type { VTimer } from '#src/lib/vtimer';

type VTimerLike = PublicLike<VTimer>;

export class MockVTimer implements VTimerLike {
	intervalCallbacks: Map<NodeJS.Timeout, () => void>;
	sleep = async (delayMs: number): Promise<void> => {
		this.sleepCalls.push(delayMs);
	};
	sleepCalls: number[];
	timeoutCallbacks: Map<NodeJS.Timeout, () => void>;

	constructor() {
		this.intervalCallbacks = new Map();
		this.sleepCalls = [];
		this.timeoutCallbacks = new Map();
	}

	clearInterval(timer: NodeJS.Timeout): void {
		this.intervalCallbacks.delete(timer);
	}

	clearTimeout(timer: NodeJS.Timeout): void {
		this.timeoutCallbacks.delete(timer);
	}

	setInterval(callback: () => void, _delayMs: number): NodeJS.Timeout {
		const timer = Symbol('interval') as unknown as NodeJS.Timeout;

		this.intervalCallbacks.set(timer, callback);

		return timer;
	}

	setTimeout(callback: () => void, _delayMs: number): NodeJS.Timeout {
		const timer = Symbol('timeout') as unknown as NodeJS.Timeout;

		this.timeoutCallbacks.set(timer, callback);

		return timer;
	}
}
