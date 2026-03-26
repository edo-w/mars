import { vi } from 'vitest';
import type { VLogger } from '#src/lib/vlogger';

export class MockVLogger implements VLogger {
	error = vi.fn<(message: string) => void>();
	info = vi.fn<(message: string) => void>();
	warn = vi.fn<(message: string) => void>();
	warning = vi.fn<(message: string) => void>();

	reset(): void {
		this.error.mockReset();
		this.info.mockReset();
		this.warn.mockReset();
		this.warning.mockReset();
	}
}
