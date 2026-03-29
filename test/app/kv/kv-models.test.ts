import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
	KvCurrentValueModel,
	KvDataType,
	KvKeyModel,
	KvKeyVersionModel,
	KvListEntryModel,
	KvPendingBlobModel,
	KvPendingBlobOperation,
	KvSecretConfigModel,
} from '#src/app/kv/kv-models';

test('KvSecretConfigModel constructs from valid fields', () => {
	const model = new KvSecretConfigModel({
		algorithm: 'AES-GCM',
		iv: 'aXY=',
	});

	assert.equal(model.algorithm, 'AES-GCM');
});

test('KvSecretConfigModel rejects invalid fields', () => {
	assert.throws(() => {
		return new KvSecretConfigModel({
			algorithm: 'bad',
			iv: 'aXY=',
		});
	});
});

test('KvKeyModel constructs from valid fields', () => {
	const model = new KvKeyModel({
		create_date: '2026-03-26T00:00:00.000Z',
		key_path: '/service/value',
		update_date: '2026-03-26T00:00:00.000Z',
	});

	assert.equal(model.key_path, '/service/value');
});

test('KvKeyModel rejects invalid fields', () => {
	assert.throws(() => {
		return new KvKeyModel({
			create_date: null,
			key_path: '/service/value',
			update_date: '2026-03-26T00:00:00.000Z',
		});
	});
});

test('KvKeyVersionModel constructs from valid fields', () => {
	const model = new KvKeyVersionModel({
		create_date: '2026-03-26T00:00:00.000Z',
		data_blob_id: null,
		data_content: new Uint8Array([1]),
		data_size: 1,
		data_type: KvDataType.Text,
		key_path: '/service/value',
		secret_config: null,
		version_id: 0,
	});

	assert.equal(model.data_type, KvDataType.Text);
});

test('KvKeyVersionModel rejects invalid fields', () => {
	assert.throws(() => {
		return new KvKeyVersionModel({
			create_date: '2026-03-26T00:00:00.000Z',
			data_blob_id: null,
			data_content: null,
			data_size: -1,
			data_type: KvDataType.Text,
			key_path: '/service/value',
			secret_config: null,
			version_id: 0,
		});
	});
});

test('KvPendingBlobModel constructs from valid fields', () => {
	const model = new KvPendingBlobModel({
		key_path: '/service/value',
		local_path: '.mars/env/gl-dev/kv/blob',
		operation: KvPendingBlobOperation.Upload,
	});

	assert.equal(model.operation, KvPendingBlobOperation.Upload);
});

test('KvPendingBlobModel rejects invalid fields', () => {
	assert.throws(() => {
		return new KvPendingBlobModel({
			key_path: '/service/value',
			local_path: '.mars/env/gl-dev/kv/blob',
			operation: 'bad',
		});
	});
});

test('KvCurrentValueModel constructs from valid fields', () => {
	const model = new KvCurrentValueModel({
		create_date: '2026-03-26T00:00:00.000Z',
		data_blob_id: null,
		data_content: new Uint8Array([1]),
		data_size: 1,
		data_type: KvDataType.Text,
		key_path: '/service/value',
		secret: false,
		secret_config: null,
		update_date: '2026-03-26T00:00:00.000Z',
		version_create_date: '2026-03-26T00:00:00.000Z',
		version_id: 0,
	});

	assert.equal(model.version_id, 0);
});

test('KvCurrentValueModel rejects invalid fields', () => {
	assert.throws(() => {
		return new KvCurrentValueModel({
			create_date: '2026-03-26T00:00:00.000Z',
			data_blob_id: null,
			data_content: null,
			data_size: 1,
			data_type: KvDataType.Text,
			key_path: '/service/value',
			secret: 'no',
			secret_config: null,
			update_date: '2026-03-26T00:00:00.000Z',
			version_create_date: '2026-03-26T00:00:00.000Z',
			version_id: 0,
		});
	});
});

test('KvListEntryModel constructs from valid fields', () => {
	const model = new KvListEntryModel({
		data_size: 1,
		data_type: KvDataType.Text,
		key_path: '/service/value',
		secret: false,
		update_date: '2026-03-26T00:00:00.000Z',
		version_id: 0,
	});

	assert.equal(model.key_path, '/service/value');
});

test('KvListEntryModel rejects invalid fields', () => {
	assert.throws(() => {
		return new KvListEntryModel({
			data_size: 1,
			data_type: 'bad',
			key_path: '/service/value',
			secret: false,
			update_date: '2026-03-26T00:00:00.000Z',
			version_id: 0,
		});
	});
});
