import { type DbClient, DbMigration } from '#src/lib/db';

class InitKvMigration extends DbMigration {
	constructor() {
		super('20260326-init-kv');
	}

	apply(db: DbClient): void {
		db.run(`
			CREATE TABLE kv_key (
				key_path TEXT PRIMARY KEY,
				create_date TEXT NOT NULL,
				update_date TEXT NOT NULL
			)
		`);
		db.run(`
			CREATE TABLE kv_key_version (
				key_path TEXT NOT NULL,
				version_id INTEGER NOT NULL,
				secret_config TEXT,
				data_type TEXT NOT NULL,
				data_content BLOB,
				data_blob_id TEXT,
				data_size INTEGER NOT NULL,
				create_date TEXT NOT NULL,
				PRIMARY KEY (key_path, version_id)
			)
		`);
		db.run(`
			CREATE TABLE kv_pending_blob (
				key_path TEXT NOT NULL,
				operation TEXT NOT NULL,
				local_path TEXT NOT NULL,
				PRIMARY KEY (key_path, operation, local_path)
			)
		`);
	}

	revert(db: DbClient): void {
		db.run('DROP TABLE IF EXISTS kv_pending_blob');
		db.run('DROP TABLE IF EXISTS kv_key_version');
		db.run('DROP TABLE IF EXISTS kv_key');
	}
}

export const initKvMigration = new InitKvMigration();
