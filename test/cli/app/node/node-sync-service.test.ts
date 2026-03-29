import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import type { BackendService } from '#src/cli/app/backend/backend-service';
import { MarsConfig } from '#src/cli/app/config/config-shapes';
import type { Environment } from '#src/cli/app/environment/environment-shapes';
import { NodeRepo } from '#src/cli/app/node/node-repo';
import { createNodeStoreBackendPath, createNodeStoreWorkPath } from '#src/cli/app/node/node-shapes';
import { NodeSyncService } from '#src/cli/app/node/node-sync-service';
import { DbClient } from '#src/lib/db';
import type { PublicLike } from '#src/lib/types';
import { Vfs } from '#src/lib/vfs';
import { MockVfs } from '#test/mocks/mock-vfs';

type BackendServiceLike = PublicLike<BackendService>;

function sut() {
	const vfs = new MockVfs();
	const backendService = new MockBackendService();
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
	const backendFactory = {
		create: async () => backendService,
	};
	const lockService = {
		acquire: async () => ({
			kind: 'ok' as const,
			lock: null,
		}),
		release: async () => {},
	};
	const service = new NodeSyncService(
		vfs as never,
		configService as never,
		backendFactory as never,
		lockService as never,
	);

	return {
		backendService,
		service,
		vfs,
	};
}

test('NodeSyncService pull skips when local store already exists', async () => {
	const { backendService, service, vfs } = sut();
	const environment = createEnvironment();
	const localStorePath = createNodeStoreWorkPath('.mars', environment.id);

	vfs.setFile(localStorePath, new TextEncoder().encode('local-db'));

	await service.pull(environment);

	const storeBytes = await vfs.readFile(localStorePath);

	assert.equal(new TextDecoder().decode(storeBytes), 'local-db');
	assert.equal(backendService.readFileCalls.length, 0);
});

test('NodeSyncService save checkpoints and writes the store db to backend', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-node-sync-'));
	const { backendService } = sut();
	const environment = createEnvironment();
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
	const backendFactory = {
		create: async () => backendService,
	};
	const lockService = {
		acquire: async () => ({
			kind: 'ok' as const,
			lock: null,
		}),
		release: async () => {},
	};
	const service = new NodeSyncService(vfs, configService as never, backendFactory as never, lockService as never);
	const localStorePath = createNodeStoreWorkPath('.mars', environment.id);

	try {
		await vfs.ensureDirectory(path.dirname(localStorePath));

		const repo = NodeRepo.open(new DbClient(vfs.resolve(localStorePath)));

		try {
			repo.checkpoint();
		} finally {
			repo.close();
		}

		const result = await service.save(environment);

		assert.equal(result.node_count, 0);
		assert.deepEqual(backendService.writeFileCalls, [createNodeStoreBackendPath(environment.id)]);
	} finally {
		await fsp.rm(tempDir, { force: true, recursive: true });
	}
});

class MockBackendService implements BackendServiceLike {
	readFileCalls: string[];
	writeFileCalls: string[];

	constructor() {
		this.readFileCalls = [];
		this.writeFileCalls = [];
	}

	async fileExists(): Promise<boolean> {
		return true;
	}

	async getFilePath(): Promise<string> {
		return '/backend/path';
	}

	async getInfo() {
		return {
			fields: [
				{
					name: 'local_path',
					value: '.mars/local',
				},
			],
			type: 'local' as const,
		};
	}

	async getLastModifiedDate(): Promise<Date | null> {
		return null;
	}

	async listDirectory(): Promise<string[]> {
		return [];
	}

	async readFile(_environment: Environment, targetPath: string): Promise<Uint8Array> {
		this.readFileCalls.push(targetPath);

		return new TextEncoder().encode('backend-db');
	}

	async readTextFile(): Promise<string> {
		return '';
	}

	async removeFile(): Promise<void> {}

	async writeFile(_environment: Environment, targetPath: string): Promise<void> {
		this.writeFileCalls.push(targetPath);
	}

	async writeTextFile(): Promise<void> {}
}

function createEnvironment(): Environment {
	return {
		config: {
			aws_account_id: '10000',
			aws_region: 'us-east-1',
			id: 'gl-dev',
			name: 'dev',
			namespace: 'gl',
		},
		configPath: 'infra/envs/dev/environment.yml',
		directoryPath: 'infra/envs/dev',
		id: 'gl-dev',
		selected: false,
	};
}
