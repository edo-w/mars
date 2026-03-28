import assert from 'node:assert/strict';
import { test } from 'vitest';
import { DbClient, DbMigration, DbMigrator } from '#src/lib/db';

class ExampleMigration extends DbMigration {
	constructor() {
		super('20260326-example');
	}

	apply(db: DbClient): void {
		db.run('CREATE TABLE example (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
	}

	revert(db: DbClient): void {
		db.run('DROP TABLE IF EXISTS example');
	}
}

test('DbMigrator applies pending migrations once', () => {
	const db = new DbClient();
	const migrator = new DbMigrator(db);
	const migration = new ExampleMigration();

	try {
		migrator.apply([migration]);
		migrator.apply([migration]);

		const rows = db.all<{ key: string }>('SELECT key FROM db_migration');

		assert.deepEqual(rows, [{ key: '20260326-example' }]);
	} finally {
		db.close();
	}
});

test('DbMigrator reverts applied migrations in reverse order', () => {
	const db = new DbClient();
	const migrator = new DbMigrator(db);
	const migration = new ExampleMigration();

	try {
		migrator.apply([migration]);
		migrator.revert([migration]);

		const row = db.get<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'example'",
		);
		const migrationRows = db.all<{ key: string }>('SELECT key FROM db_migration');

		assert.equal(row, null);
		assert.deepEqual(migrationRows, []);
	} finally {
		db.close();
	}
});
