import type { SQLQueryBindings } from 'bun:sqlite';
import { nodeMigrations } from '#src/app/node/migrations';
import { NodeEventModel, NodeListEntryModel, NodeModel, NodeTagModel } from '#src/app/node/node-models';
import { type DbClient, DbMigrator } from '#src/lib/db';

interface NodeInventoryRow {
	create_date: string;
	hostname: string | null;
	id: string;
	private_ip: string | null;
	properties_json: string;
	public_ip: string;
	status: 'bootstrap' | 'fail' | 'new' | 'ready';
	update_date: string;
}

interface NodeEventRow {
	action: string;
	context_json: string;
	date: string;
	node_id: string;
}

export class NodeRepo {
	db: DbClient;

	constructor(db: DbClient) {
		this.db = db;
	}

	addTag(nodeId: string, tag: string): void {
		const nodeTag = new NodeTagModel({
			node_id: nodeId,
			tag,
		});

		this.db.run('INSERT OR IGNORE INTO node_tag (node_id, tag) VALUES (?, ?)', [nodeTag.node_id, nodeTag.tag]);
	}

	checkpoint(): void {
		this.db.checkpoint();
	}

	close(): void {
		this.db.close();
	}

	create(node: NodeModel): void {
		this.db.run(
			`
				INSERT INTO node_inventory (
					id,
					hostname,
					public_ip,
					private_ip,
					status,
					properties_json,
					create_date,
					update_date
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`,
			[
				node.id,
				node.hostname,
				node.public_ip,
				node.private_ip,
				node.status,
				JSON.stringify(node.properties),
				node.create_date,
				node.update_date,
			],
		);
	}

	createEvent(event: NodeEventModel): void {
		this.db.run(
			`
				INSERT INTO node_event (
					node_id,
					action,
					date,
					context_json
				) VALUES (?, ?, ?, ?)
			`,
			[event.node_id, event.action, event.date, JSON.stringify(event.context)],
		);
	}

	get(nodeId: string): NodeModel | null {
		const row = this.readNodeRow('WHERE id = ?', [nodeId]);

		return row === null ? null : this.createNodeModel(row);
	}

	getByPublicIp(publicIp: string): NodeModel | null {
		const row = this.readNodeRow('WHERE public_ip = ?', [publicIp]);

		return row === null ? null : this.createNodeModel(row);
	}

	list(tags: string[]): NodeListEntryModel[] {
		const useTagFilter = tags.length > 0;
		const placeholders = tags.map(() => '?').join(', ');
		const rows = this.db.all<NodeInventoryRow>(
			useTagFilter
				? `
					SELECT DISTINCT
						id,
						hostname,
						public_ip,
						private_ip,
						status,
						properties_json,
						create_date,
						update_date
					FROM node_inventory
					WHERE id IN (
						SELECT node_id
						FROM node_tag
						WHERE tag IN (${placeholders})
					)
					ORDER BY hostname, public_ip, id
				`
				: `
					SELECT
						id,
						hostname,
						public_ip,
						private_ip,
						status,
						properties_json,
						create_date,
						update_date
					FROM node_inventory
					ORDER BY hostname, public_ip, id
				`,
			tags,
		);

		return rows.map((row) => {
			return new NodeListEntryModel({
				hostname: row.hostname,
				id: row.id,
				private_ip: row.private_ip,
				public_ip: row.public_ip,
				status: row.status,
				tags: this.listTags(row.id),
			});
		});
	}

	listEvents(nodeId: string | null): NodeEventModel[] {
		const filterByNodeId = nodeId !== null;
		const query = filterByNodeId
			? 'SELECT node_id, action, date, context_json FROM node_event WHERE node_id = ? ORDER BY date'
			: 'SELECT node_id, action, date, context_json FROM node_event ORDER BY date';
		const bindings = filterByNodeId ? [nodeId] : [];
		const rows = this.db.all<NodeEventRow>(query, bindings);

		return rows.map((row) => {
			return new NodeEventModel({
				action: row.action,
				context: JSON.parse(row.context_json),
				date: row.date,
				node_id: row.node_id,
			});
		});
	}

	listTags(nodeId: string): string[] {
		const rows = this.db.all<{ tag: string }>('SELECT tag FROM node_tag WHERE node_id = ? ORDER BY tag', [nodeId]);

		return rows.map((row) => row.tag);
	}

	remove(nodeId: string): void {
		this.db.transaction(() => {
			this.db.run('DELETE FROM node_tag WHERE node_id = ?', [nodeId]);
			this.db.run('DELETE FROM node_inventory WHERE id = ?', [nodeId]);
		});
	}

	removeTag(nodeId: string, tag: string): void {
		this.db.run('DELETE FROM node_tag WHERE node_id = ? AND tag = ?', [nodeId, tag]);
	}

	update(node: NodeModel): void {
		this.db.run(
			`
				UPDATE node_inventory
				SET
					hostname = ?,
					public_ip = ?,
					private_ip = ?,
					status = ?,
					properties_json = ?,
					create_date = ?,
					update_date = ?
				WHERE id = ?
			`,
			[
				node.hostname,
				node.public_ip,
				node.private_ip,
				node.status,
				JSON.stringify(node.properties),
				node.create_date,
				node.update_date,
				node.id,
			],
		);
	}

	static open(db: DbClient): NodeRepo {
		const migrator = new DbMigrator(db);

		migrator.apply(nodeMigrations);

		return new NodeRepo(db);
	}

	transaction<T>(callback: () => T): T {
		return this.db.transaction(callback);
	}

	private createNodeModel(row: NodeInventoryRow): NodeModel {
		return new NodeModel({
			create_date: row.create_date,
			hostname: row.hostname,
			id: row.id,
			private_ip: row.private_ip,
			properties: JSON.parse(row.properties_json),
			public_ip: row.public_ip,
			status: row.status,
			update_date: row.update_date,
		});
	}

	private readNodeRow(whereClause: string, bindings: SQLQueryBindings[]): NodeInventoryRow | null {
		return this.db.get<NodeInventoryRow>(
			`
				SELECT
					id,
					hostname,
					public_ip,
					private_ip,
					status,
					properties_json,
					create_date,
					update_date
				FROM node_inventory
				${whereClause}
			`,
			bindings,
		);
	}
}
