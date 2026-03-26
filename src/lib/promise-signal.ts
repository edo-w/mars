export class PromiseSignal {
	promise: Promise<void>;
	rejectPromise: ((error?: unknown) => void) | null;
	resolvePromise: (() => void) | null;

	constructor() {
		this.rejectPromise = null;
		this.resolvePromise = null;
		this.promise = new Promise<void>((resolve, reject) => {
			this.rejectPromise = reject;
			this.resolvePromise = resolve;
		});
	}

	reject(error?: unknown): void {
		const rejectPromise = this.rejectPromise;

		if (rejectPromise === null) {
			return;
		}

		this.rejectPromise = null;
		this.resolvePromise = null;
		rejectPromise(error);
	}

	resolve(): void {
		const resolvePromise = this.resolvePromise;

		if (resolvePromise === null) {
			return;
		}

		this.rejectPromise = null;
		this.resolvePromise = null;
		resolvePromise();
	}

	async wait(): Promise<void> {
		await this.promise;
	}
}
