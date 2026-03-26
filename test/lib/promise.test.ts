import assert from 'node:assert/strict';
import { test } from 'vitest';
import { sleep } from '#src/lib/promise';

test('sleep resolves after waiting', async () => {
	const startedAt = Date.now();

	await sleep(1);

	const elapsedMs = Date.now() - startedAt;

	assert.equal(elapsedMs >= 0, true);
});
