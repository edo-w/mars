import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { BackendService } from '#src/app/backend/backend-service';
import { MarsConfig } from '#src/app/config/config-shapes';
import type { Environment } from '#src/app/environment/environment-shapes';
import { createKvStoreWorkPath } from '#src/app/kv/kv-shapes';
import { KvSyncService } from '#src/app/kv/kv-sync-service';
import type { PublicLike } from '#src/lib/types';
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
		acquire: async () => null,
		release: async () => {},
	};
	const service = new KvSyncService(
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

test('KvSyncService pull skips when local store db already exists', async () => {
	const { backendService, service, vfs } = sut();
	const environment = createEnvironment();
	const localStorePath = createKvStoreWorkPath('.mars', environment.id);

	vfs.setFile(localStorePath, new TextEncoder().encode('local-db'));

	await service.pull(environment);

	const storeBytes = await vfs.readFile(localStorePath);

	assert.equal(new TextDecoder().decode(storeBytes), 'local-db');
	assert.equal(backendService.readFileCalls.length, 0);
});

class MockBackendService implements BackendServiceLike {
	readFileCalls: string[];

	constructor() {
		this.readFileCalls = [];
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

		return new Uint8Array();
	}

	async readTextFile(): Promise<string> {
		return '';
	}

	async removeFile(): Promise<void> {}

	async writeFile(): Promise<void> {}

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
