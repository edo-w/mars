import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PromiseSignal } from '#src/lib/promise-signal';

test('PromiseSignal resolves waiters when resolve is called', async () => {
	const signal = new PromiseSignal();

	signal.resolve();
	await signal.wait();
	assert.ok(true);
});

test('PromiseSignal rejects waiters when reject is called', async () => {
	const signal = new PromiseSignal();

	signal.reject(new Error('boom'));

	await assert.rejects(async () => {
		await signal.wait();
	}, /boom/);
});

test('PromiseSignal ignores repeated resolve and reject calls after settling', async () => {
	const signal = new PromiseSignal();

	signal.resolve();
	signal.resolve();
	signal.reject(new Error('boom'));
	await signal.wait();
	assert.ok(true);
});
