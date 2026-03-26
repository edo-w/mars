import { afterEach, beforeEach } from 'vitest';
import { vlogManager } from '#src/lib/vlogger';
import { MockVLogger } from '#test/mocks/mock-vlogger';

export function useMockVLogger(): MockVLogger {
	const logger = new MockVLogger();

	beforeEach(() => {
		logger.reset();
		vlogManager.setFactory(() => {
			return logger;
		});
	});
	afterEach(() => {
		vlogManager.resetFactory();
	});

	return logger;
}
