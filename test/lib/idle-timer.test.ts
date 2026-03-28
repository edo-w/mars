import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { IdleTimer } from '#src/lib/idle-timer';

test('IdleTimer ticks after start', async () => {
	vi.useFakeTimers();
	const timer = new IdleTimer(100);
	const calls: string[] = [];

	timer.onTick(() => {
		calls.push('tick');
	});
	timer.start();
	await vi.advanceTimersByTimeAsync(100);

	assert.deepEqual(calls, ['tick']);
	vi.useRealTimers();
});

test('IdleTimer reset restarts the delay', async () => {
	vi.useFakeTimers();
	const timer = new IdleTimer(100);
	const calls: string[] = [];

	timer.onTick(() => {
		calls.push('tick');
	});
	timer.start();
	await vi.advanceTimersByTimeAsync(50);
	timer.reset();
	await vi.advanceTimersByTimeAsync(75);

	assert.deepEqual(calls, []);
	await vi.advanceTimersByTimeAsync(25);
	assert.deepEqual(calls, ['tick']);
	vi.useRealTimers();
});

test('IdleTimer stop prevents the tick', async () => {
	vi.useFakeTimers();
	const timer = new IdleTimer(100);
	const calls: string[] = [];

	timer.onTick(() => {
		calls.push('tick');
	});
	timer.start();
	timer.stop();
	await vi.advanceTimersByTimeAsync(100);

	assert.deepEqual(calls, []);
	vi.useRealTimers();
});

test('IdleTimer requires a callback before start', () => {
	const timer = new IdleTimer(100);

	assert.throws(() => {
		timer.start();
	}, /idle timer callback not configured/);
});
