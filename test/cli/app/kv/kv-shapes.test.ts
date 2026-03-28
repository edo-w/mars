import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
	createKvBlobBackendPath,
	createKvBlobWorkPath,
	createKvDirectoryWorkPath,
	createKvStoreBackendPath,
	createKvStoreShmWorkPath,
	createKvStoreWalWorkPath,
	createKvStoreWorkPath,
	getKvBlobId,
	KvKeyReference,
	parseKvKeyPath,
	parseKvKeyPrefix,
	parseKvKeyReference,
} from '#src/cli/app/kv/kv-shapes';

test('KvKeyReference constructs from valid fields', () => {
	const reference = new KvKeyReference({
		key_path: '/service/value',
		version_id: 1,
	});

	assert.equal(reference.version_id, 1);
});

test('KvKeyReference rejects invalid fields', () => {
	assert.throws(() => {
		return new KvKeyReference({
			key_path: 'bad',
			version_id: 1,
		});
	});
});

test('kv path helpers create the expected paths', () => {
	assert.equal(createKvBlobBackendPath('gl-dev', 'blob'), 'env/gl-dev/kv/blobs/blob');
	assert.equal(createKvBlobWorkPath('.mars', 'gl-dev', 'blob'), '.mars/env/gl-dev/kv/blobs/blob');
	assert.equal(createKvDirectoryWorkPath('.mars', 'gl-dev'), '.mars/env/gl-dev/kv');
	assert.equal(createKvStoreBackendPath('gl-dev'), 'env/gl-dev/kv/store.db');
	assert.equal(createKvStoreWorkPath('.mars', 'gl-dev'), '.mars/env/gl-dev/kv/store.db');
	assert.equal(createKvStoreWalWorkPath('.mars', 'gl-dev'), '.mars/env/gl-dev/kv/store.db-wal');
	assert.equal(createKvStoreShmWorkPath('.mars', 'gl-dev'), '.mars/env/gl-dev/kv/store.db-shm');
});

test('getKvBlobId returns the blob id from the path', () => {
	assert.equal(getKvBlobId('.mars/env/gl-dev/kv/blobs/blob'), 'blob');
});

test('parseKvKeyPath validates kv key paths', () => {
	assert.equal(parseKvKeyPath('/service/value'), '/service/value');
	assert.throws(() => parseKvKeyPath('/service/#bad'));
});

test('parseKvKeyPrefix allows root and normal prefixes', () => {
	assert.equal(parseKvKeyPrefix('/'), '/');
	assert.equal(parseKvKeyPrefix('/service/value'), '/service/value');
});

test('parseKvKeyReference supports explicit version addressing', () => {
	const reference = parseKvKeyReference('/service/value#3');

	assert.equal(reference.key_path, '/service/value');
	assert.equal(reference.version_id, 3);
});
