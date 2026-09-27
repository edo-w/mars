import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';

const { mockSpawn, mockUnref } = vi.hoisted(() => {
	return {
		mockSpawn: vi.fn(() => {
			return {
				unref: mockUnref,
			};
		}),
		mockUnref: vi.fn(),
	};
});

vi.mock('node:child_process', () => {
	return {
		default: {
			spawn: mockSpawn,
		},
	};
});

const { VProcess } = await import('#src/lib/vprocess');

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

beforeEach(() => {
	mockSpawn.mockReset();
	mockUnref.mockReset();
});

test('VProcess forceKill uses the default kill signal on Windows', () => {
	const vprocess = new VProcess();
	const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
		return true;
	});

	withPlatform('win32', () => {
		vprocess.forceKill(123);
	});

	assert.deepEqual(kill.mock.calls[0], [123]);
	kill.mockRestore();
});

test('VProcess forceKill uses SIGKILL on non-Windows platforms', () => {
	const vprocess = new VProcess();
	const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
		return true;
	});

	withPlatform('linux', () => {
		vprocess.forceKill(123);
	});

	assert.deepEqual(kill.mock.calls[0], [123, 'SIGKILL']);
	kill.mockRestore();
});

test('VProcess isProcessAlive returns true when process.kill succeeds', () => {
	const vprocess = new VProcess();
	const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
		return true;
	});
	const alive = vprocess.isProcessAlive(123);

	assert.equal(alive, true);
	assert.deepEqual(kill.mock.calls[0], [123, 0]);
	kill.mockRestore();
});

test('VProcess isProcessAlive returns false when process.kill throws', () => {
	const vprocess = new VProcess();
	const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
		throw new Error('missing');
	});
	const alive = vprocess.isProcessAlive(123);

	assert.equal(alive, false);
	kill.mockRestore();
});

test('VProcess getProcessInvocation uses the script path when argv points to a script entry', () => {
	const vprocess = new VProcess();
	const originalArgv = process.argv;

	process.argv = ['bun', 'src/cli/main.ts'];

	try {
		const invocation = vprocess.getProcessInvocation(['key-agent', 'serve']);

		assert.equal(invocation.command, process.execPath);
		assert.deepEqual(invocation.args, ['src/cli/main.ts', 'key-agent', 'serve']);
	} finally {
		process.argv = originalArgv;
	}
});

test('VProcess spawnDetached delegates to child_process.spawn and unreferences the child', () => {
	const vprocess = new VProcess();

	vprocess.spawnDetached('bun', ['key-agent', 'serve'], '/repo');

	assert.deepEqual(mockSpawn.mock.calls[0], [
		'bun',
		['key-agent', 'serve'],
		{
			cwd: '/repo',
			detached: true,
			stdio: 'ignore',
			windowsHide: true,
		},
	]);
	assert.equal(mockUnref.mock.calls.length, 1);
});
