import type { DbClient } from '#src/lib/db/db-client';

export abstract class DbMigration {
	key: string;

	constructor(key: string) {
		this.key = key;
	}

	abstract apply(db: DbClient): void;
	abstract revert(db: DbClient): void;
}
