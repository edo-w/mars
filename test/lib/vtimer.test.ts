import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { VTimer } from '#src/lib/vtimer';

test('VTimer sleep resolves after waiting', async () => {
	vi.useFakeTimers();
	const vtimer = new VTimer();
	let resolved = false;

	const sleepPromise = vtimer.sleep(100).then(() => {
		resolved = true;
	});

	await vi.advanceTimersByTimeAsync(99);
	assert.equal(resolved, false);

	await vi.advanceTimersByTimeAsync(1);
	await sleepPromise;
	assert.equal(resolved, true);
	vi.useRealTimers();
});

test('VTimer setTimeout and clearTimeout delegate to the platform timers', async () => {
	vi.useFakeTimers();
	const vtimer = new VTimer();
	const calls: string[] = [];

	const timeout = vtimer.setTimeout(() => {
		calls.push('tick');
	}, 100);

	vtimer.clearTimeout(timeout);
	await vi.advanceTimersByTimeAsync(100);

	assert.deepEqual(calls, []);
	vi.useRealTimers();
});

test('VTimer setInterval and clearInterval delegate to the platform timers', async () => {
	vi.useFakeTimers();
	const vtimer = new VTimer();
	const calls: string[] = [];

	const interval = vtimer.setInterval(() => {
		calls.push('tick');
	}, 50);

	await vi.advanceTimersByTimeAsync(120);
	vtimer.clearInterval(interval);
	await vi.advanceTimersByTimeAsync(100);

	assert.deepEqual(calls, ['tick', 'tick']);
	vi.useRealTimers();
});
