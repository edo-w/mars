import path from 'node:path';
import * as z from 'zod';

export const KV_DIRECTORY = 'kv';
export const KV_STORE_FILE = 'store.db';
export const KV_BLOBS_DIRECTORY = 'blobs';
export const KV_INLINE_VALUE_LIMIT_BYTES = 16 * 1024;

const kvKeyPathSchema = z.string().regex(/^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)$/);
const kvKeyPrefixSchema = z.union([z.literal('/'), kvKeyPathSchema]);

export class KvKeyReference {
	static schema = z.object({
		key_path: kvKeyPathSchema,
		version_id: z.number().int().nonnegative().nullable(),
	});

	key_path: string;
	version_id: number | null;

	constructor(fields: unknown) {
		const parsed = KvKeyReference.schema.parse(fields);

		this.key_path = parsed.key_path;
		this.version_id = parsed.version_id;
	}
}

export interface KvGetResult {
	data: Uint8Array;
	key_path: string;
	secret: boolean;
	type: 'text' | 'file';
	version_id: number;
}

export interface KvListResultItem {
	date: string;
	key: string;
	secret: boolean;
	size: number;
	type: 'text' | 'file';
}

export interface KvSetInput {
	data: Uint8Array;
	key_path: string;
	secret: boolean;
	type: 'text' | 'file';
}

export interface KvSetResult {
	key_path: string;
	secret: boolean;
	type: 'text' | 'file';
	version_id: number;
}

export interface KvShowResult {
	create_date: string;
	key_path: string;
	secret: boolean;
	size: number;
	type: 'text' | 'file';
	update_date: string;
	version_id: number;
}

export interface KvStateSaveResult {
	deleted_blob_count: number;
	uploaded_blob_count: number;
}

export function createKvBlobBackendPath(environmentId: string, blobId: string): string {
	return path.posix.join('env', environmentId, KV_DIRECTORY, KV_BLOBS_DIRECTORY, blobId);
}

export function createKvBlobWorkPath(workPath: string, environmentId: string, blobId: string): string {
	return path.posix.join(workPath, 'env', environmentId, KV_DIRECTORY, KV_BLOBS_DIRECTORY, blobId);
}

export function createKvDirectoryWorkPath(workPath: string, environmentId: string): string {
	return path.posix.join(workPath, 'env', environmentId, KV_DIRECTORY);
}

export function createKvStoreBackendPath(environmentId: string): string {
	return path.posix.join('env', environmentId, KV_DIRECTORY, KV_STORE_FILE);
}

export function createKvStoreWorkPath(workPath: string, environmentId: string): string {
	return path.posix.join(createKvDirectoryWorkPath(workPath, environmentId), KV_STORE_FILE);
}

export function createKvStoreWalWorkPath(workPath: string, environmentId: string): string {
	return `${createKvStoreWorkPath(workPath, environmentId)}-wal`;
}

export function createKvStoreShmWorkPath(workPath: string, environmentId: string): string {
	return `${createKvStoreWorkPath(workPath, environmentId)}-shm`;
}

export function getKvBlobId(localPath: string): string {
	return path.posix.basename(localPath);
}

export function parseKvKeyPath(keyPath: string): string {
	return kvKeyPathSchema.parse(keyPath);
}

export function parseKvKeyPrefix(keyPath: string): string {
	return kvKeyPrefixSchema.parse(keyPath);
}

export function parseKvKeyReference(value: string): KvKeyReference {
	const hashIndex = value.lastIndexOf('#');

	if (hashIndex === -1) {
		return new KvKeyReference({
			key_path: parseKvKeyPath(value),
			version_id: null,
		});
	}

	const keyPath = value.slice(0, hashIndex);
	const versionText = value.slice(hashIndex + 1);
	const versionId = z.coerce.number().int().nonnegative().parse(versionText);

	return new KvKeyReference({
		key_path: parseKvKeyPath(keyPath),
		version_id: versionId,
	});
}
