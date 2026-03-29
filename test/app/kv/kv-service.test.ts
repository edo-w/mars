import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, vi } from 'vitest';
import { MarsConfig } from '#src/app/config/config-shapes';
import { KvDataType, KvPendingBlobOperation } from '#src/app/kv/kv-models';
import { KvRepo } from '#src/app/kv/kv-repo';
import { KvService } from '#src/app/kv/kv-service';
import { createKvStoreWorkPath } from '#src/app/kv/kv-shapes';
import type { SecretsService } from '#src/app/secrets/secrets-service';
import {
	EncryptedSecretRecord,
	type EncryptedSecretRecord as EncryptedSecretValue,
} from '#src/app/secrets/secrets-shapes';
import { DbClient } from '#src/lib/db';
import { Vfs } from '#src/lib/vfs';
import { createEnvironment } from '#test/helpers/environment';

function sut() {
	const environment = createEnvironment();
	const syncService = new MockKvSyncService();
	const secretsService = new MockSecretsService();

	return {
		environment,
		secretsService,
		syncService,
		async create(tempDir: string) {
			const vfs = new Vfs(tempDir);
			const config = new MarsConfig({
				namespace: 'gl',
				envs_path: 'infra/envs',
				work_path: '.mars',
				backend: {
					local: {},
				},
				secrets: {
					password: {},
				},
			});
			const configService = {
				get: async () => config,
			};
			const service = new KvService(vfs, configService as never, syncService as never, secretsService as never);

			return {
				service,
				vfs,
			};
		},
	};
}

test('KvService sets and gets inline text values', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-kv-service-'));
	const setup = sut();
	let service: KvService | null = null;

	try {
		const created = await setup.create(tempDir);
		const vfs = created.vfs;

		service = created.service;

		const setResult = await service.set(setup.environment, {
			data: new TextEncoder().encode('hello'),
			key_path: '/service/value',
			secret: false,
			type: KvDataType.Text,
		});
		const getResult = await service.get(setup.environment, '/service/value');
		const showResult = await service.show(setup.environment, '/service/value');
		const listResult = await service.list(setup.environment, '/service');

		assert.equal(setResult.version_id, 0);
		assert.equal(new TextDecoder().decode(getResult?.data), 'hello');
		assert.equal(showResult?.secret, false);
		assert.deepEqual(
			listResult.map((item) => item.key),
			['/service/value'],
		);
		assert.equal(setup.syncService.ensureLocalStateCalls.length, 4);

		const repo = openRepo(vfs, setup.environment.id);

		try {
			assert.equal(repo.getCurrentValue('/service/value')?.data_blob_id, null);
		} finally {
			repo.close();
		}
	} finally {
		await service?.close();
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('KvService encrypts secret values through the secrets service', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-kv-service-'));
	const setup = sut();
	let service: KvService | null = null;

	try {
		const created = await setup.create(tempDir);
		const vfs = created.vfs;

		service = created.service;

		await service.set(setup.environment, {
			data: new TextEncoder().encode('secret'),
			key_path: '/service/secret',
			secret: true,
			type: KvDataType.Text,
		});

		const getResult = await service.get(setup.environment, '/service/secret');

		assert.equal(new TextDecoder().decode(getResult?.data), 'secret');
		assert.equal(setup.secretsService.encryptBytesCalls.length, 1);
		assert.equal(setup.secretsService.decryptBytesCalls.length, 1);

		const repo = openRepo(vfs, setup.environment.id);

		try {
			const currentValue = repo.getCurrentValue('/service/secret');

			assert.equal(currentValue?.secret, true);
			assert.notEqual(currentValue?.secret_config, null);
		} finally {
			repo.close();
		}
	} finally {
		await service?.close();
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('KvService stores file values as pending blob uploads and remove tracks deletes', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-kv-service-'));
	const setup = sut();
	let service: KvService | null = null;

	try {
		const created = await setup.create(tempDir);
		const vfs = created.vfs;

		service = created.service;

		await service.set(setup.environment, {
			data: new Uint8Array([1, 2, 3]),
			key_path: '/service/file',
			secret: false,
			type: KvDataType.File,
		});

		const repo = openRepo(vfs, setup.environment.id);

		try {
			const pendingUploads = repo.listPendingBlobs();

			assert.equal(pendingUploads.length, 1);
			assert.equal(pendingUploads[0]?.operation, KvPendingBlobOperation.Upload);
		} finally {
			repo.close();
		}

		const removed = await service.remove(setup.environment, '/service/file');

		assert.equal(removed, true);

		const nextRepo = openRepo(vfs, setup.environment.id);

		try {
			const pendingBlobs = nextRepo.listPendingBlobs();

			assert.equal(
				pendingBlobs.some((entry) => entry.operation === KvPendingBlobOperation.Delete),
				true,
			);
		} finally {
			nextRepo.close();
		}
	} finally {
		await service?.close();
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('KvService reuses the same repo until close is called', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-kv-service-'));
	const setup = sut();
	const openRepo = vi.spyOn(KvRepo, 'open');
	let service: KvService | null = null;

	try {
		const created = await setup.create(tempDir);

		service = created.service;

		await service.list(setup.environment, '/');
		await service.show(setup.environment, '/missing');
		await service.get(setup.environment, '/missing');

		assert.equal(openRepo.mock.calls.length, 1);

		await service.close();
		await service.list(setup.environment, '/');

		assert.equal(openRepo.mock.calls.length, 2);
	} finally {
		await service?.close();
		openRepo.mockRestore();
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

function openRepo(vfs: Vfs, environmentId: string): KvRepo {
	const db = new DbClient(vfs.resolve(createKvStoreWorkPath('.mars', environmentId)));

	return KvRepo.open(db);
}

class MockKvSyncService {
	ensureLocalStateCalls: string[];

	constructor() {
		this.ensureLocalStateCalls = [];
	}

	async clear(): Promise<void> {}

	async ensureLocalState(environment: { id: string }): Promise<void> {
		this.ensureLocalStateCalls.push(environment.id);
	}

	async pull(): Promise<void> {}

	async pullBlob(): Promise<void> {}

	async save() {
		return {
			deleted_blob_count: 0,
			uploaded_blob_count: 0,
		};
	}
}

class MockSecretsService implements SecretsService {
	decryptBytesCalls: EncryptedSecretValue[];
	encryptBytesCalls: Uint8Array[];

	constructor() {
		this.decryptBytesCalls = [];
		this.encryptBytesCalls = [];
	}

	async decryptBytes(_environment: { id: string }, encryptedSecret: EncryptedSecretValue): Promise<Uint8Array> {
		this.decryptBytesCalls.push(encryptedSecret);

		return new Uint8Array(Buffer.from(encryptedSecret.ciphertext, 'base64'));
	}

	async decryptText(): Promise<string> {
		return 'secret';
	}

	async encryptBytes(_environment: { id: string }, plaintext: Uint8Array): Promise<EncryptedSecretRecord> {
		this.encryptBytesCalls.push(plaintext);

		return new EncryptedSecretRecord({
			algorithm: 'AES-GCM',
			ciphertext: Buffer.from(plaintext).toString('base64'),
			iv: 'aXY=',
		});
	}

	async encryptText(): Promise<EncryptedSecretRecord> {
		return new EncryptedSecretRecord({
			algorithm: 'AES-GCM',
			ciphertext: 'c2VjcmV0',
			iv: 'aXY=',
		});
	}
}
