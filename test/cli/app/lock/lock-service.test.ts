import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { BackendService } from '#src/cli/app/backend/backend-service';
import type { Environment } from '#src/cli/app/environment/environment-shapes';
import { LockService } from '#src/cli/app/lock/lock-service';
import type { PublicLike } from '#src/lib/types';

type BackendServiceLike = PublicLike<BackendService>;

function sut(backendService: BackendServiceLike) {
	const backendFactory = {
		create: async () => backendService,
	};
	const service = new LockService(backendFactory as never);

	return {
		service,
	};
}

test('LockService returns ok without a lock for the local backend', async () => {
	const backendService = new MockBackendService('local');
	const { service } = sut(backendService);
	const environment = createEnvironment();

	const result = await service.acquire(environment, 'kv');

	assert.deepEqual(result, {
		kind: 'ok',
		lock: null,
	});
});

test('LockService returns fail when a non-expired lock already exists', async () => {
	const backendService = new MockBackendService('s3');
	const { service } = sut(backendService);
	const environment = createEnvironment();

	backendService.setTextFile(
		'mars/env/gl-dev/lock/kv.json',
		`${JSON.stringify({
			expire_at: new Date(Date.now() + 60_000).toISOString(),
			holder: 'host:1',
			token: 'token-1',
		})}\n`,
	);

	const result = await service.acquire(environment, 'kv');

	if (result.kind !== 'fail') {
		throw new Error('expected failed lock acquire');
	}

	assert.match(result.error, /lock "kv" is held by "host:1"/);
});

test('LockService writes and releases a lock through the backend', async () => {
	const backendService = new MockBackendService('s3');
	const { service } = sut(backendService);
	const environment = createEnvironment();

	const result = await service.acquire(environment, 'kv');

	assert.equal(result.kind, 'ok');
	assert.equal(backendService.fileExistsCalls.includes('mars/env/gl-dev/lock/kv.json'), true);
	assert.notEqual(backendService.textFiles.get('mars/env/gl-dev/lock/kv.json'), undefined);

	await service.release(environment, 'kv');

	assert.equal(backendService.textFiles.has('mars/env/gl-dev/lock/kv.json'), false);
});

class MockBackendService implements BackendServiceLike {
	fileExistsCalls: string[];
	infoType: 'local' | 's3';
	textFiles: Map<string, string>;

	constructor(infoType: 'local' | 's3') {
		this.fileExistsCalls = [];
		this.infoType = infoType;
		this.textFiles = new Map();
	}

	async fileExists(_environment: Environment, targetPath: string): Promise<boolean> {
		this.fileExistsCalls.push(targetPath);

		return this.textFiles.has(targetPath);
	}

	async getFilePath(): Promise<string> {
		return '';
	}

	async getInfo() {
		return {
			fields: [],
			type: this.infoType,
		};
	}

	async getLastModifiedDate(): Promise<Date | null> {
		return null;
	}

	async listDirectory(): Promise<string[]> {
		return [];
	}

	async readFile(): Promise<Uint8Array> {
		return new Uint8Array();
	}

	async readTextFile(_environment: Environment, targetPath: string): Promise<string> {
		const contents = this.textFiles.get(targetPath);

		if (contents === undefined) {
			throw new Error(`missing file "${targetPath}"`);
		}

		return contents;
	}

	async removeFile(_environment: Environment, targetPath: string): Promise<void> {
		this.textFiles.delete(targetPath);
	}

	setTextFile(targetPath: string, contents: string): void {
		this.textFiles.set(targetPath, contents);
	}

	async writeFile(): Promise<void> {}

	async writeTextFile(_environment: Environment, targetPath: string, contents: string): Promise<void> {
		this.textFiles.set(targetPath, contents);
	}
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
