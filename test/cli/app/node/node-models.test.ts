import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
	NodeEventAction,
	NodeEventModel,
	NodeListEntryModel,
	NodeModel,
	NodeStatus,
	NodeTagModel,
} from '#src/cli/app/node/node-models';

test('NodeModel constructs from valid fields', () => {
	const model = new NodeModel({
		create_date: '2026-03-28T12:00:00.000Z',
		hostname: 'api-1',
		id: 'ip-1-2-3-4',
		private_ip: '10.0.0.5',
		properties: {
			'docker.installed': true,
			'ssh.port': 22,
		},
		public_ip: '1.2.3.4',
		status: NodeStatus.New,
		update_date: '2026-03-28T12:00:00.000Z',
	});

	assert.equal(model.id, 'ip-1-2-3-4');
	assert.equal(model.properties['ssh.port'], 22);
});

test('NodeModel rejects invalid fields', () => {
	assert.throws(() => {
		return new NodeModel({
			create_date: '2026-03-28T12:00:00.000Z',
			hostname: 'api-1',
			id: '',
			private_ip: '10.0.0.5',
			properties: {
				'bad key': true,
			},
			public_ip: '1.2.3.4',
			status: 'bad',
			update_date: '2026-03-28T12:00:00.000Z',
		});
	});
});

test('node event, tag, and list models construct from valid fields', () => {
	const event = new NodeEventModel({
		action: NodeEventAction.SetStatus,
		context: {
			new: 'ready',
			prev: 'new',
		},
		date: '2026-03-28T12:00:00.000Z',
		node_id: 'ip-1-2-3-4',
	});
	const tag = new NodeTagModel({
		node_id: 'ip-1-2-3-4',
		tag: 'master',
	});
	const listItem = new NodeListEntryModel({
		hostname: 'api-1',
		id: 'ip-1-2-3-4',
		private_ip: '10.0.0.5',
		public_ip: '1.2.3.4',
		status: NodeStatus.Ready,
		tags: ['db', 'master'],
	});

	assert.equal(event.action, NodeEventAction.SetStatus);
	assert.equal(tag.tag, 'master');
	assert.equal(listItem.status, NodeStatus.Ready);
});

test('node event, tag, and list models reject invalid fields', () => {
	assert.throws(() => {
		return new NodeEventModel({
			action: 'bad',
			context: {},
			date: '2026-03-28T12:00:00.000Z',
			node_id: 'ip-1-2-3-4',
		});
	});
	assert.throws(() => {
		return new NodeTagModel({
			node_id: 'ip-1-2-3-4',
			tag: 'bad tag',
		});
	});
	assert.throws(() => {
		return new NodeListEntryModel({
			hostname: 'api-1',
			id: '',
			private_ip: null,
			public_ip: '1.2.3.4',
			status: 'bad',
			tags: [],
		});
	});
});
