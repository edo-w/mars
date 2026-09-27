import type { VTimer } from '#src/lib/vtimer';
import { VTimer as RealVTimer } from '#src/lib/vtimer';

export class IdleTimer {
	callback: (() => void) | null;
	delayMs: number;
	timer: NodeJS.Timeout | null;
	vtimer: VTimer;

	constructor(delayMs: number, vtimer: VTimer = new RealVTimer()) {
		this.callback = null;
		this.delayMs = delayMs;
		this.timer = null;
		this.vtimer = vtimer;
	}

	onTick(callback: () => void): void {
		this.callback = callback;
	}

	reset(): void {
		this.stop();
		this.start();
	}

	start(): void {
		const callback = this.callback;

		if (callback === null) {
			throw new Error('idle timer callback not configured');
		}

		this.timer = this.vtimer.setTimeout(() => {
			this.timer = null;
			callback();
		}, this.delayMs);
	}

	stop(): void {
		if (this.timer === null) {
			return;
		}

		this.vtimer.clearTimeout(this.timer);
		this.timer = null;
	}
}
