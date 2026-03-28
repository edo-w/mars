import { Database, type SQLQueryBindings } from 'bun:sqlite';

export class DbClient {
	database: Database;

	constructor(targetPath = ':memory:') {
		this.database = new Database(targetPath, {
			create: true,
			readwrite: true,
			strict: true,
		});
	}

	all<T>(sql: string, bindings: SQLQueryBindings[] = []): T[] {
		return this.database.query<T, SQLQueryBindings[]>(sql).all(...bindings);
	}

	checkpoint(): void {
		this.database.run('PRAGMA wal_checkpoint(TRUNCATE)');
	}

	close(): void {
		this.database.close();
	}

	exec(sql: string): void {
		this.database.run(sql);
	}

	get<T>(sql: string, bindings: SQLQueryBindings[] = []): T | null {
		const row = this.database.query<T, SQLQueryBindings[]>(sql).get(...bindings);

		return row ?? null;
	}

	run(sql: string, bindings: SQLQueryBindings[] = []): void {
		this.database.run(sql, bindings);
	}

	transaction<T>(callback: () => T): T {
		const runInTransaction = this.database.transaction(callback);

		return runInTransaction();
	}
}
