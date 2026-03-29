import { type DbClient, DbMigration } from '#src/lib/db';

class InitNodeMigration extends DbMigration {
	constructor() {
		super('20260328-init-node');
	}

	apply(db: DbClient): void {
		db.run(`
			CREATE TABLE node_inventory (
				id TEXT PRIMARY KEY,
				hostname TEXT,
				public_ip TEXT NOT NULL UNIQUE,
				private_ip TEXT,
				status TEXT NOT NULL,
				properties_json TEXT NOT NULL,
				create_date TEXT NOT NULL,
				update_date TEXT NOT NULL
			)
		`);
		db.run(`
			CREATE TABLE node_tag (
				node_id TEXT NOT NULL,
				tag TEXT NOT NULL,
				PRIMARY KEY (node_id, tag),
				FOREIGN KEY (node_id) REFERENCES node_inventory(id) ON DELETE CASCADE
			)
		`);
		db.run(`
			CREATE TABLE node_event (
				node_id TEXT NOT NULL,
				action TEXT NOT NULL,
				date TEXT NOT NULL,
				context_json TEXT NOT NULL
			)
		`);
		db.run(`
			CREATE INDEX node_tag_tag_idx
			ON node_tag (tag)
		`);
		db.run(`
			CREATE INDEX node_event_node_date_idx
			ON node_event (node_id, date)
		`);
	}

	revert(db: DbClient): void {
		db.run('DROP INDEX IF EXISTS node_event_node_date_idx');
		db.run('DROP INDEX IF EXISTS node_tag_tag_idx');
		db.run('DROP TABLE IF EXISTS node_event');
		db.run('DROP TABLE IF EXISTS node_tag');
		db.run('DROP TABLE IF EXISTS node_inventory');
	}
}

export const initNodeMigration = new InitNodeMigration();
