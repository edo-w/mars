import assert from 'node:assert/strict';
import { test } from 'vitest';
import { NodeEventAction, NodeStatus } from '#src/app/node/node-models';
import {
	createNodeDirectoryWorkPath,
	createNodeEvent,
	createNodeId,
	createNodeModel,
	createNodeStoreBackendPath,
	createNodeStoreShmWorkPath,
	createNodeStoreWalWorkPath,
	createNodeStoreWorkPath,
	formatNodePropertyValue,
	isMutableNodePropertyKey,
	parseNodeCreateValue,
	parseNodePropertyKey,
	parseNodePropertyValue,
	parseNodeReference,
	readNodeListTags,
} from '#src/app/node/node-shapes';

test('node shape helpers format paths and ids', () => {
	assert.equal(createNodeDirectoryWorkPath('.mars', 'gl-dev'), '.mars/env/gl-dev/node');
	assert.equal(createNodeStoreWorkPath('.mars', 'gl-dev'), '.mars/env/gl-dev/node/store.db');
	assert.equal(createNodeStoreWalWorkPath('.mars', 'gl-dev'), '.mars/env/gl-dev/node/store.db-wal');
	assert.equal(createNodeStoreShmWorkPath('.mars', 'gl-dev'), '.mars/env/gl-dev/node/store.db-shm');
	assert.equal(createNodeStoreBackendPath('gl-dev'), 'env/gl-dev/node/store.db');
	assert.equal(createNodeId('1.2.3.4'), 'ip-1-2-3-4');
});

test('parseNodeCreateValue and parseNodeReference support ipv4 and mars ids', () => {
	const createFromIp = parseNodeCreateValue('1.2.3.4');
	const createFromId = parseNodeCreateValue('ip-1-2-3-4');

	assert.equal(createFromIp.id, 'ip-1-2-3-4');
	assert.equal(createFromIp.public_ip, '1.2.3.4');
	assert.equal(createFromId.id, 'ip-1-2-3-4');
	assert.equal(parseNodeReference('1.2.3.4'), 'ip-1-2-3-4');
	assert.equal(parseNodeReference('ip-1-2-3-4'), 'ip-1-2-3-4');
	assert.throws(() => parseNodeReference('ip-999-1-1-1'));
});

test('createNodeModel creates the default node shape', () => {
	const model = createNodeModel(parseNodeCreateValue('1.2.3.4'), '2026-03-28T12:00:00.000Z');

	assert.equal(model.id, 'ip-1-2-3-4');
	assert.equal(model.public_ip, '1.2.3.4');
	assert.equal(model.status, NodeStatus.New);
	assert.deepEqual(model.properties, {});
});

test('property helpers validate and parse property keys and values', () => {
	assert.equal(parseNodePropertyKey('os.name'), 'os.name');
	assert.throws(() => parseNodePropertyKey('bad key'));
	assert.equal(parseNodePropertyValue('true'), true);
	assert.equal(parseNodePropertyValue('42'), 42);
	assert.equal(parseNodePropertyValue('ubuntu'), 'ubuntu');
	assert.equal(formatNodePropertyValue(true), 'true');
	assert.equal(isMutableNodePropertyKey('hostname'), true);
	assert.equal(isMutableNodePropertyKey('public_ip'), false);
});

test('tag and event helpers normalize values', () => {
	assert.deepEqual(readNodeListTags('MASTER,db'), ['master', 'db']);

	const event = createNodeEvent(NodeEventAction.SetStatus, 'ip-1-2-3-4', {
		new: 'ready',
		prev: 'new',
	});

	assert.equal(event.node_id, 'ip-1-2-3-4');
	assert.equal(event.action, NodeEventAction.SetStatus);
});
