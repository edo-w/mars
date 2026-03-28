export class IdleTimer {
	callback: (() => void) | null;
	delayMs: number;
	timer: NodeJS.Timeout | null;

	constructor(delayMs: number) {
		this.callback = null;
		this.delayMs = delayMs;
		this.timer = null;
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

		this.timer = setTimeout(() => {
			this.timer = null;
			callback();
		}, this.delayMs);
	}

	stop(): void {
		if (this.timer === null) {
			return;
		}

		clearTimeout(this.timer);
		this.timer = null;
	}
}
