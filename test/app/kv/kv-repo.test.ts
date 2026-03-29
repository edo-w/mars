import assert from 'node:assert/strict';
import { test } from 'vitest';
import { KvDataType, KvPendingBlobModel, KvPendingBlobOperation, KvSecretConfigModel } from '#src/app/kv/kv-models';
import { KvRepo } from '#src/app/kv/kv-repo';
import { DbClient } from '#src/lib/db';

function sut() {
	const db = new DbClient();
	const repo = KvRepo.open(db);

	return {
		repo,
	};
}

test('KvRepo creates and reads current values', () => {
	const { repo } = sut();

	try {
		repo.createVersion({
			create_date: '2026-03-26T00:00:00.000Z',
			data_blob_id: null,
			data_content: new Uint8Array([1, 2, 3]),
			data_size: 3,
			data_type: KvDataType.Text,
			key_path: '/service/value',
			secret_config: null,
		});

		const key = repo.getKey('/service/value');
		const currentValue = repo.getCurrentValue('/service/value');

		assert.equal(key?.key_path, '/service/value');
		assert.equal(currentValue?.version_id, 0);
		assert.deepEqual(currentValue?.data_content, new Uint8Array([1, 2, 3]));
	} finally {
		repo.close();
	}
});

test('KvRepo increments version ids for repeated writes', () => {
	const { repo } = sut();

	try {
		repo.createVersion({
			create_date: '2026-03-26T00:00:00.000Z',
			data_blob_id: null,
			data_content: new Uint8Array([1]),
			data_size: 1,
			data_type: KvDataType.Text,
			key_path: '/service/value',
			secret_config: null,
		});
		repo.createVersion({
			create_date: '2026-03-26T01:00:00.000Z',
			data_blob_id: null,
			data_content: new Uint8Array([2]),
			data_size: 1,
			data_type: KvDataType.Text,
			key_path: '/service/value',
			secret_config: new KvSecretConfigModel({
				algorithm: 'AES-GCM',
				iv: 'aXY=',
			}),
		});

		const versions = repo.listVersions('/service/value');
		const currentValue = repo.getCurrentValue('/service/value');

		assert.deepEqual(
			versions.map((version) => version.version_id),
			[0, 1],
		);
		assert.equal(currentValue?.version_id, 1);
		assert.equal(currentValue?.secret, true);
	} finally {
		repo.close();
	}
});

test('KvRepo lists latest values under a prefix', () => {
	const { repo } = sut();

	try {
		repo.createVersion({
			create_date: '2026-03-26T00:00:00.000Z',
			data_blob_id: null,
			data_content: new Uint8Array([1]),
			data_size: 1,
			data_type: KvDataType.Text,
			key_path: '/service/one',
			secret_config: null,
		});
		repo.createVersion({
			create_date: '2026-03-26T00:00:00.000Z',
			data_blob_id: null,
			data_content: new Uint8Array([1]),
			data_size: 1,
			data_type: KvDataType.File,
			key_path: '/service/two',
			secret_config: null,
		});

		const items = repo.list('/service');

		assert.deepEqual(
			items.map((item) => item.key_path),
			['/service/one', '/service/two'],
		);
	} finally {
		repo.close();
	}
});

test('KvRepo tracks pending blobs', () => {
	const { repo } = sut();
	const pendingBlob = new KvPendingBlobModel({
		key_path: '/service/value',
		local_path: '.mars/env/gl-dev/kv/blobs/blob',
		operation: KvPendingBlobOperation.Upload,
	});

	try {
		repo.addPendingBlob(pendingBlob);

		const pendingBlobs = repo.listPendingBlobs();

		assert.deepEqual(pendingBlobs, [pendingBlob]);

		repo.removePendingBlob(pendingBlob);

		assert.deepEqual(repo.listPendingBlobs(), []);
	} finally {
		repo.close();
	}
});

test('KvRepo removes keys and versions', () => {
	const { repo } = sut();

	try {
		repo.createVersion({
			create_date: '2026-03-26T00:00:00.000Z',
			data_blob_id: null,
			data_content: new Uint8Array([1]),
			data_size: 1,
			data_type: KvDataType.Text,
			key_path: '/service/value',
			secret_config: null,
		});

		repo.removeKey('/service/value');

		assert.equal(repo.getKey('/service/value'), null);
		assert.equal(repo.getCurrentValue('/service/value'), null);
	} finally {
		repo.close();
	}
});
