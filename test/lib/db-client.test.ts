import assert from 'node:assert/strict';
import { test } from 'vitest';
import { DbClient } from '#src/lib/db';

test('DbClient runs queries and returns rows', () => {
	const db = new DbClient();

	try {
		db.run('CREATE TABLE example (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
		db.run('INSERT INTO example (name) VALUES (?)', ['mars']);

		const row = db.get<{ name: string }>('SELECT name FROM example WHERE id = ?', [1]);
		const rows = db.all<{ name: string }>('SELECT name FROM example ORDER BY id');

		assert.deepEqual(row, { name: 'mars' });
		assert.deepEqual(rows, [{ name: 'mars' }]);
	} finally {
		db.close();
	}
});

test('DbClient transaction rolls back when callback throws', () => {
	const db = new DbClient();

	try {
		db.run('CREATE TABLE example (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');

		assert.throws(() => {
			db.transaction(() => {
				db.run('INSERT INTO example (name) VALUES (?)', ['mars']);

				throw new Error('stop');
			});
		}, /stop/);

		const rows = db.all<{ id: number }>('SELECT id FROM example');

		assert.deepEqual(rows, []);
	} finally {
		db.close();
	}
});

test('DbClient checkpoint executes without error', () => {
	const db = new DbClient();

	try {
		db.checkpoint();

		assert.ok(true);
	} finally {
		db.close();
	}
});
