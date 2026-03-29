import assert from 'node:assert/strict';
import { test } from 'vitest';
import { NodeEventAction, NodeModel, NodeStatus } from '#src/app/node/node-models';
import { NodeRepo } from '#src/app/node/node-repo';
import { createNodeEvent } from '#src/app/node/node-shapes';
import { DbClient } from '#src/lib/db';

function sut() {
	const db = new DbClient();
	const repo = NodeRepo.open(db);

	return {
		repo,
	};
}

function createNode(id: string, publicIp: string): NodeModel {
	return new NodeModel({
		create_date: '2026-03-28T12:00:00.000Z',
		hostname: 'api-1',
		id,
		private_ip: '10.0.0.5',
		properties: {
			'os.name': 'ubuntu',
		},
		public_ip: publicIp,
		status: NodeStatus.New,
		update_date: '2026-03-28T12:00:00.000Z',
	});
}

test('NodeRepo creates and reads nodes by id and public_ip', () => {
	const { repo } = sut();
	const node = createNode('ip-1-2-3-4', '1.2.3.4');

	try {
		repo.create(node);

		assert.equal(repo.get(node.id)?.id, node.id);
		assert.equal(repo.getByPublicIp('1.2.3.4')?.id, node.id);
	} finally {
		repo.close();
	}
});

test('NodeRepo lists nodes and filters by matching tags', () => {
	const { repo } = sut();
	const firstNode = createNode('ip-1-2-3-4', '1.2.3.4');
	const secondNode = createNode('ip-1-2-3-5', '1.2.3.5');

	try {
		repo.create(firstNode);
		repo.create(secondNode);
		repo.addTag(firstNode.id, 'master');
		repo.addTag(secondNode.id, 'db');

		const allItems = repo.list([]);
		const taggedItems = repo.list(['master', 'web']);

		assert.equal(allItems.length, 2);
		assert.deepEqual(
			taggedItems.map((item) => item.id),
			[firstNode.id],
		);
		assert.deepEqual(repo.listTags(firstNode.id), ['master']);
	} finally {
		repo.close();
	}
});

test('NodeRepo replaces nodes and stores mutation events', () => {
	const { repo } = sut();
	const node = createNode('ip-1-2-3-4', '1.2.3.4');

	try {
		repo.create(node);

		const nextNode = new NodeModel({
			...JSON.parse(JSON.stringify(node)),
			hostname: 'api-2',
			status: NodeStatus.Ready,
			update_date: '2026-03-28T13:00:00.000Z',
		});

		repo.update(nextNode);
		repo.createEvent(
			createNodeEvent(NodeEventAction.SetStatus, node.id, {
				new: 'ready',
				prev: 'new',
			}),
		);

		const events = repo.listEvents(node.id);
		const allEvents = repo.listEvents(null);

		assert.equal(repo.get(node.id)?.hostname, 'api-2');
		assert.equal(events.length, 1);
		assert.equal(allEvents.length, 1);
		assert.equal(events[0]?.action, NodeEventAction.SetStatus);
	} finally {
		repo.close();
	}
});

test('NodeRepo removes nodes and tags', () => {
	const { repo } = sut();
	const node = createNode('ip-1-2-3-4', '1.2.3.4');

	try {
		repo.create(node);
		repo.addTag(node.id, 'master');
		repo.removeTag(node.id, 'master');
		repo.remove(node.id);

		assert.equal(repo.get(node.id), null);
		assert.deepEqual(repo.listTags(node.id), []);
	} finally {
		repo.close();
	}
});
