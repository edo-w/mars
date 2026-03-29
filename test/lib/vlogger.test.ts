import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { LogtapeVLogger } from '#src/lib/vlogger';

interface MockLogger {
	error: ReturnType<typeof vi.fn>;
	info: ReturnType<typeof vi.fn>;
	warn: ReturnType<typeof vi.fn>;
	warning: ReturnType<typeof vi.fn>;
}

function createMockLogger(): MockLogger {
	return {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		warning: vi.fn(),
	};
}

test('LogtapeVLogger logs literal info messages through the message property', () => {
	const logger = createMockLogger();
	const vlogger = new LogtapeVLogger(logger as never);

	vlogger.info('/^ip-\\d{1,3}-\\d{1,3}-\\d{1,3}-\\d{1,3}$/');

	assert.deepEqual(logger.info.mock.calls[0], ['/^ip-\\d\\{1,3\\}-\\d\\{1,3\\}-\\d\\{1,3\\}-\\d\\{1,3\\}$/']);
});

test('LogtapeVLogger logs literal error messages through the message property', () => {
	const logger = createMockLogger();
	const vlogger = new LogtapeVLogger(logger as never);

	vlogger.error('[{"message":"must match /^ip-\\\\d{1,3}$/"}]');

	assert.deepEqual(logger.error.mock.calls[0], ['[\\{"message":"must match /^ip-\\\\d\\{1,3\\}$/"\\}]']);
});
