import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { forceKill, isProcessAlive } from '#src/lib/process';

function withPlatform(platform: NodeJS.Platform, callback: () => void) {
	const originalPlatform = process.platform;

	Object.defineProperty(process, 'platform', {
		value: platform,
	});

	try {
		callback();
	} finally {
		Object.defineProperty(process, 'platform', {
			value: originalPlatform,
		});
	}
}

test('forceKill uses the default kill signal on Windows', () => {
	const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
		return true;
	});

	withPlatform('win32', () => {
		forceKill(123);
	});

	assert.deepEqual(kill.mock.calls[0], [123]);
	kill.mockRestore();
});

test('forceKill uses SIGKILL on non-Windows platforms', () => {
	const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
		return true;
	});

	withPlatform('linux', () => {
		forceKill(123);
	});

	assert.deepEqual(kill.mock.calls[0], [123, 'SIGKILL']);
	kill.mockRestore();
});

test('isProcessAlive returns true when process.kill succeeds', () => {
	const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
		return true;
	});
	const alive = isProcessAlive(123);

	assert.equal(alive, true);
	assert.deepEqual(kill.mock.calls[0], [123, 0]);
	kill.mockRestore();
});

test('isProcessAlive returns false when process.kill throws', () => {
	const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
		throw new Error('missing');
	});
	const alive = isProcessAlive(123);

	assert.equal(alive, false);
	kill.mockRestore();
});
