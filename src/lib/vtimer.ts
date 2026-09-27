export class VTimer {
	async sleep(delayMs: number): Promise<void> {
		await new Promise<void>((resolve) => {
			this.setTimeout(resolve, delayMs);
		});
	}

	setInterval(callback: () => void, delayMs: number): NodeJS.Timeout {
		return setInterval(callback, delayMs);
	}

	setTimeout(callback: () => void, delayMs: number): NodeJS.Timeout {
		return setTimeout(callback, delayMs);
	}

	clearInterval(timer: NodeJS.Timeout): void {
		clearInterval(timer);
	}

	clearTimeout(timer: NodeJS.Timeout): void {
		clearTimeout(timer);
	}
}
