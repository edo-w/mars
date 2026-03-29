import path from 'node:path';
import * as z from 'zod';

export const LOCK_DIRECTORY = 'lock';
export const LOCK_TTL_MS = 3 * 60 * 1000;

export class LockRecord {
	static schema = z.object({
		expire_at: z.string().min(1),
		holder: z.string().min(1),
		token: z.string().min(1),
	});

	expire_at: string;
	holder: string;
	token: string;

	constructor(fields: unknown) {
		const parsed = LockRecord.schema.parse(fields);

		this.expire_at = parsed.expire_at;
		this.holder = parsed.holder;
		this.token = parsed.token;
	}
}

export interface AcquireOkResult {
	kind: 'ok';
	lock: LockRecord | null;
}

export interface AcquireFailResult {
	error: string;
	kind: 'fail';
}

export type AcquireLockResult = AcquireOkResult | AcquireFailResult;

export function createLockBackendPath(environmentId: string, lockName: string): string {
	return path.posix.join('env', environmentId, LOCK_DIRECTORY, `${lockName}.json`);
}

export function createLockKey(environmentId: string, lockName: string): string {
	return `${environmentId}:${lockName}`;
}
