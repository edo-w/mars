import type { DbClient } from '#src/lib/db/db-client';
import type { DbMigration } from '#src/lib/db/db-migration';

interface MigrationRow {
	key: string;
}

export class DbMigrator {
	db: DbClient;

	constructor(db: DbClient) {
		this.db = db;
	}

	apply(migrations: DbMigration[]): void {
		this.db.transaction(() => {
			this.ensureMigrationsTable();

			for (const migration of migrations) {
				const migrationIsApplied = this.isMigrationApplied(migration.key);

				if (migrationIsApplied) {
					continue;
				}

				migration.apply(this.db);
				this.db.run('INSERT INTO db_migration (key, apply_date) VALUES (?, ?)', [
					migration.key,
					new Date().toISOString(),
				]);
			}
		});
	}

	revert(migrations: DbMigration[]): void {
		const reversedMigrations = [...migrations].reverse();

		this.db.transaction(() => {
			this.ensureMigrationsTable();

			for (const migration of reversedMigrations) {
				const migrationIsApplied = this.isMigrationApplied(migration.key);

				if (!migrationIsApplied) {
					continue;
				}

				migration.revert(this.db);
				this.db.run('DELETE FROM db_migration WHERE key = ?', [migration.key]);
			}
		});
	}

	private ensureMigrationsTable(): void {
		this.db.run(`
			CREATE TABLE IF NOT EXISTS db_migration (
				key TEXT PRIMARY KEY,
				apply_date TEXT NOT NULL
			)
		`);
	}

	private isMigrationApplied(key: string): boolean {
		const row = this.db.get<MigrationRow>('SELECT key FROM db_migration WHERE key = ?', [key]);

		return row !== null;
	}
}
