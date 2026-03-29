import {
	KvCurrentValueModel,
	KvKeyModel,
	KvKeyVersionModel,
	KvListEntryModel,
	KvPendingBlobModel,
	type KvSecretConfigModel,
} from '#src/app/kv/kv-models';
import { kvMigrations } from '#src/app/kv/migrations';
import { type DbClient, DbMigrator } from '#src/lib/db';

interface KvCurrentValueRow {
	create_date: string;
	data_blob_id: string | null;
	data_content: Uint8Array | null;
	data_size: number;
	data_type: 'text' | 'file';
	key_path: string;
	secret: number;
	secret_config: string | null;
	update_date: string;
	version_create_date: string;
	version_id: number;
}

interface KvKeyVersionRow {
	create_date: string;
	data_blob_id: string | null;
	data_content: Uint8Array | null;
	data_size: number;
	data_type: 'text' | 'file';
	key_path: string;
	secret_config: string | null;
	version_id: number;
}

interface KvListEntryRow {
	data_size: number;
	data_type: 'text' | 'file';
	key_path: string;
	secret: number;
	update_date: string;
	version_id: number;
}

interface KvMaxVersionRow {
	version_id: number | null;
}

export interface CreateKvVersionOptions {
	create_date: string;
	data_blob_id: string | null;
	data_content: Uint8Array | null;
	data_size: number;
	data_type: 'text' | 'file';
	key_path: string;
	secret_config: KvSecretConfigModel | null;
}

export class KvRepo {
	db: DbClient;

	constructor(db: DbClient) {
		this.db = db;
	}

	addPendingBlob(model: KvPendingBlobModel): void {
		this.db.run('INSERT OR REPLACE INTO kv_pending_blob (key_path, operation, local_path) VALUES (?, ?, ?)', [
			model.key_path,
			model.operation,
			model.local_path,
		]);
	}

	checkpoint(): void {
		this.db.checkpoint();
	}

	close(): void {
		this.db.close();
	}

	createVersion(options: CreateKvVersionOptions): KvKeyVersionModel {
		return this.db.transaction(() => {
			const existingKey = this.getKey(options.key_path);
			const nextVersionId = this.readNextVersionId(options.key_path);
			const createDate = existingKey?.create_date ?? options.create_date;
			const secretConfigText = options.secret_config === null ? null : JSON.stringify(options.secret_config);

			if (existingKey === null) {
				this.db.run('INSERT INTO kv_key (key_path, create_date, update_date) VALUES (?, ?, ?)', [
					options.key_path,
					createDate,
					options.create_date,
				]);
			} else {
				this.db.run('UPDATE kv_key SET update_date = ? WHERE key_path = ?', [
					options.create_date,
					options.key_path,
				]);
			}

			this.db.run(
				`
					INSERT INTO kv_key_version (
						key_path,
						version_id,
						secret_config,
						data_type,
						data_content,
						data_blob_id,
						data_size,
						create_date
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`,
				[
					options.key_path,
					nextVersionId,
					secretConfigText,
					options.data_type,
					options.data_content,
					options.data_blob_id,
					options.data_size,
					options.create_date,
				],
			);

			return new KvKeyVersionModel({
				create_date: options.create_date,
				data_blob_id: options.data_blob_id,
				data_content: options.data_content,
				data_size: options.data_size,
				data_type: options.data_type,
				key_path: options.key_path,
				secret_config: options.secret_config,
				version_id: nextVersionId,
			});
		});
	}

	getCurrentValue(keyPath: string): KvCurrentValueModel | null {
		const row = this.db.get<KvCurrentValueRow>(
			`
				SELECT
					k.key_path,
					k.create_date,
					k.update_date,
					v.version_id,
					v.secret_config,
					v.data_type,
					v.data_content,
					v.data_blob_id,
					v.data_size,
					v.create_date AS version_create_date,
					CASE WHEN v.secret_config IS NULL THEN 0 ELSE 1 END AS secret
				FROM kv_key k
				JOIN kv_key_version v
					ON v.key_path = k.key_path
				WHERE
					k.key_path = ?
					AND v.version_id = (
						SELECT MAX(version_id)
						FROM kv_key_version
						WHERE key_path = k.key_path
					)
			`,
			[keyPath],
		);

		return row === null ? null : this.createCurrentValueModel(row);
	}

	getKey(keyPath: string): KvKeyModel | null {
		const row = this.db.get<KvKeyModel>(
			'SELECT key_path, create_date, update_date FROM kv_key WHERE key_path = ?',
			[keyPath],
		);

		return row === null ? null : new KvKeyModel(row);
	}

	getVersion(keyPath: string, versionId: number): KvKeyVersionModel | null {
		const row = this.db.get<KvKeyVersionRow>(
			`
				SELECT
					key_path,
					version_id,
					secret_config,
					data_type,
					data_content,
					data_blob_id,
					data_size,
					create_date
				FROM kv_key_version
				WHERE key_path = ? AND version_id = ?
			`,
			[keyPath, versionId],
		);

		return row === null ? null : this.createKeyVersionModel(row);
	}

	list(prefix: string): KvListEntryModel[] {
		const pattern = prefix === '/' ? '/%' : `${prefix}/%`;
		const rows = this.db.all<KvListEntryRow>(
			`
				SELECT
					k.key_path,
					k.update_date,
					v.version_id,
					v.data_type,
					v.data_size,
					CASE WHEN v.secret_config IS NULL THEN 0 ELSE 1 END AS secret
				FROM kv_key k
				JOIN kv_key_version v
					ON v.key_path = k.key_path
				WHERE
					k.key_path LIKE ?
					AND v.version_id = (
						SELECT MAX(version_id)
						FROM kv_key_version
						WHERE key_path = k.key_path
					)
				ORDER BY k.key_path
			`,
			[pattern],
		);

		return rows.map((row) => {
			return new KvListEntryModel({
				data_size: row.data_size,
				data_type: row.data_type,
				key_path: row.key_path,
				secret: row.secret === 1,
				update_date: row.update_date,
				version_id: row.version_id,
			});
		});
	}

	listPendingBlobs(): KvPendingBlobModel[] {
		const rows = this.db.all<KvPendingBlobModel>(
			'SELECT key_path, operation, local_path FROM kv_pending_blob ORDER BY key_path, operation, local_path',
		);

		return rows.map((row) => new KvPendingBlobModel(row));
	}

	listVersions(keyPath: string): KvKeyVersionModel[] {
		const rows = this.db.all<KvKeyVersionRow>(
			`
				SELECT
					key_path,
					version_id,
					secret_config,
					data_type,
					data_content,
					data_blob_id,
					data_size,
					create_date
				FROM kv_key_version
				WHERE key_path = ?
				ORDER BY version_id
			`,
			[keyPath],
		);

		return rows.map((row) => this.createKeyVersionModel(row));
	}

	removeKey(keyPath: string): void {
		this.db.transaction(() => {
			this.db.run('DELETE FROM kv_key_version WHERE key_path = ?', [keyPath]);
			this.db.run('DELETE FROM kv_key WHERE key_path = ?', [keyPath]);
		});
	}

	removePendingBlob(model: KvPendingBlobModel): void {
		this.db.run('DELETE FROM kv_pending_blob WHERE key_path = ? AND operation = ? AND local_path = ?', [
			model.key_path,
			model.operation,
			model.local_path,
		]);
	}

	static open(db: DbClient): KvRepo {
		const migrator = new DbMigrator(db);

		migrator.apply(kvMigrations);

		return new KvRepo(db);
	}

	private createCurrentValueModel(row: KvCurrentValueRow): KvCurrentValueModel {
		return new KvCurrentValueModel({
			create_date: row.create_date,
			data_blob_id: row.data_blob_id,
			data_content: row.data_content,
			data_size: row.data_size,
			data_type: row.data_type,
			key_path: row.key_path,
			secret: row.secret === 1,
			secret_config: row.secret_config === null ? null : JSON.parse(row.secret_config),
			update_date: row.update_date,
			version_create_date: row.version_create_date,
			version_id: row.version_id,
		});
	}

	private createKeyVersionModel(row: KvKeyVersionRow): KvKeyVersionModel {
		return new KvKeyVersionModel({
			create_date: row.create_date,
			data_blob_id: row.data_blob_id,
			data_content: row.data_content,
			data_size: row.data_size,
			data_type: row.data_type,
			key_path: row.key_path,
			secret_config: row.secret_config === null ? null : JSON.parse(row.secret_config),
			version_id: row.version_id,
		});
	}

	private readNextVersionId(keyPath: string): number {
		const row = this.db.get<KvMaxVersionRow>(
			'SELECT MAX(version_id) AS version_id FROM kv_key_version WHERE key_path = ?',
			[keyPath],
		);
		const maxVersionId = row?.version_id ?? null;

		return maxVersionId === null ? 0 : maxVersionId + 1;
	}
}
