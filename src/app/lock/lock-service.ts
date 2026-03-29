import os from 'node:os';
import path from 'node:path';
import type { BackendFactory } from '#src/app/backend/backend-factory';
import type { Environment } from '#src/app/environment/environment-shapes';
import {
	type AcquireLockResult,
	createLockBackendPath,
	createLockKey,
	LOCK_TTL_MS,
	LockRecord,
} from '#src/app/lock/lock-shapes';

export class LockService {
	activeLocks: Map<string, LockRecord>;
	backendFactory: BackendFactory;

	constructor(backendFactory: BackendFactory) {
		this.activeLocks = new Map();
		this.backendFactory = backendFactory;
	}

	async acquire(environment: Environment, lockName: string): Promise<AcquireLockResult> {
		const backendService = await this.backendFactory.create();
		const backendInfo = await backendService.getInfo(environment);

		if (backendInfo.type === 'local') {
			return {
				kind: 'ok',
				lock: null,
			};
		}

		const lockPath = path.posix.join('mars', createLockBackendPath(environment.id, lockName));
		const currentLock = await this.readLock(environment, lockPath);

		if (currentLock !== null && new Date(currentLock.expire_at).getTime() > Date.now()) {
			return {
				error: `lock "${lockName}" is held by "${currentLock.holder}"`,
				kind: 'fail',
			};
		}

		const lock = new LockRecord({
			expire_at: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
			holder: `${os.hostname()}:${process.pid}`,
			token: crypto.randomUUID(),
		});
		const lockText = `${JSON.stringify(lock, null, 2)}\n`;

		await backendService.writeTextFile(environment, lockPath, lockText);

		const confirmedLock = await this.readLock(environment, lockPath);

		if (confirmedLock === null || confirmedLock.token !== lock.token) {
			return {
				error: `failed to verify lock "${lockName}"`,
				kind: 'fail',
			};
		}

		this.activeLocks.set(createLockKey(environment.id, lockName), confirmedLock);

		return {
			kind: 'ok',
			lock: confirmedLock,
		};
	}

	async release(environment: Environment, lockName: string): Promise<void> {
		const lockKey = createLockKey(environment.id, lockName);
		const heldLock = this.activeLocks.get(lockKey);

		if (heldLock === undefined) {
			return;
		}

		const backendService = await this.backendFactory.create();
		const backendInfo = await backendService.getInfo(environment);

		if (backendInfo.type === 'local') {
			this.activeLocks.delete(lockKey);
			return;
		}

		const lockPath = path.posix.join('mars', createLockBackendPath(environment.id, lockName));
		const currentLock = await this.readLock(environment, lockPath);

		if (currentLock !== null && currentLock.token === heldLock.token) {
			await backendService.removeFile(environment, lockPath);
		}

		this.activeLocks.delete(lockKey);
	}

	private async readLock(environment: Environment, lockPath: string): Promise<LockRecord | null> {
		const backendService = await this.backendFactory.create();
		const lockExists = await backendService.fileExists(environment, lockPath);

		if (!lockExists) {
			return null;
		}

		const lockText = await backendService.readTextFile(environment, lockPath);
		const lockFields = JSON.parse(lockText) as unknown;

		return new LockRecord(lockFields);
	}
}
