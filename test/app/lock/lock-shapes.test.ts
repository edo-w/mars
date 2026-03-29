import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createLockBackendPath, createLockKey, LockRecord } from '#src/app/lock/lock-shapes';

test('LockRecord constructs from valid fields', () => {
	const record = new LockRecord({
		expire_at: '2026-03-26T00:00:00.000Z',
		holder: 'host:1',
		token: 'token',
	});

	assert.equal(record.token, 'token');
});

test('LockRecord rejects invalid fields', () => {
	assert.throws(() => {
		return new LockRecord({
			expire_at: '2026-03-26T00:00:00.000Z',
			holder: 'host:1',
			token: '',
		});
	});
});

test('lock path helpers create the expected paths', () => {
	assert.equal(createLockBackendPath('gl-dev', 'kv'), 'env/gl-dev/lock/kv.json');
	assert.equal(createLockKey('gl-dev', 'kv'), 'gl-dev:kv');
});
