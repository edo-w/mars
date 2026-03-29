import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, vi } from 'vitest';
import { MarsConfig } from '#src/cli/app/config/config-shapes';
import { NodeStatus } from '#src/cli/app/node/node-models';
import { NodeRepo } from '#src/cli/app/node/node-repo';
import { NodeService } from '#src/cli/app/node/node-service';
import { parseNodeCreateValue } from '#src/cli/app/node/node-shapes';
import { Vfs } from '#src/lib/vfs';
import { createEnvironment } from '#test/helpers/environment';

function sut() {
	const environment = createEnvironment();
	const syncService = new MockNodeSyncService();

	return {
		environment,
		syncService,
		async create(tempDir: string) {
			const vfs = new Vfs(tempDir);
			const config = new MarsConfig({
				namespace: 'gl',
				envs_path: 'infra/envs',
				work_path: '.mars',
				backend: {
					local: {},
				},
				secrets: {
					password: {},
				},
			});
			const configService = {
				get: async () => config,
			};
			const service = new NodeService(vfs, configService as never, syncService as never);

			return {
				service,
			};
		},
	};
}

test('NodeService creates, gets, and lists nodes', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-node-service-'));
	const setup = sut();
	let service: NodeService | null = null;

	try {
		const created = await setup.create(tempDir);

		service = created.service;

		const node = await service.create(setup.environment, parseNodeCreateValue('1.2.3.4'));
		const getResult = await service.get(setup.environment, node.id);
		const listResult = await service.list(setup.environment, []);

		assert.equal(getResult?.node.id, node.id);
		assert.equal(listResult.length, 1);
		assert.equal(setup.syncService.ensureLocalStateCalls.length, 3);
	} finally {
		await service?.close();
		await fsp.rm(tempDir, { force: true, recursive: true });
	}
});

test('NodeService rejects duplicate public_ip values', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-node-service-'));
	const setup = sut();
	let service: NodeService | null = null;

	try {
		const created = await setup.create(tempDir);

		service = created.service;

		await service.create(setup.environment, parseNodeCreateValue('1.2.3.4'));

		await assert.rejects(() => {
			return service!.create(setup.environment, parseNodeCreateValue('1.2.3.4'));
		});
	} finally {
		await service?.close();
		await fsp.rm(tempDir, { force: true, recursive: true });
	}
});

test('NodeService sets status and property values and records get results', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-node-service-'));
	const setup = sut();
	let service: NodeService | null = null;

	try {
		const created = await setup.create(tempDir);

		service = created.service;

		const node = await service.create(setup.environment, parseNodeCreateValue('1.2.3.4'));
		const readyNode = await service.setStatus(setup.environment, node.id, NodeStatus.Ready);
		const hostnameValue = await service.setProperty(setup.environment, node.id, 'hostname', 'api-1');
		const osNameValue = await service.setProperty(setup.environment, node.id, 'os.name', 'ubuntu');
		const getHostname = await service.getProperty(setup.environment, node.id, 'hostname');
		const getOsName = await service.getProperty(setup.environment, node.id, 'os.name');

		assert.equal(readyNode?.status, NodeStatus.Ready);
		assert.equal(hostnameValue, 'api-1');
		assert.equal(osNameValue, 'ubuntu');
		assert.deepEqual(getHostname, { kind: 'ok', value: 'api-1' });
		assert.deepEqual(getOsName, { kind: 'ok', value: 'ubuntu' });
	} finally {
		await service?.close();
		await fsp.rm(tempDir, { force: true, recursive: true });
	}
});

test('NodeService lists node events for all nodes and a specific node', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-node-service-'));
	const setup = sut();
	let service: NodeService | null = null;

	try {
		const created = await setup.create(tempDir);

		service = created.service;

		const firstNode = await service.create(setup.environment, parseNodeCreateValue('1.2.3.4'));
		const secondNode = await service.create(setup.environment, parseNodeCreateValue('1.2.3.5'));

		await service.setStatus(setup.environment, firstNode.id, NodeStatus.Ready);
		await service.setProperty(setup.environment, secondNode.id, 'os.name', 'ubuntu');

		const allEvents = await service.listEvents(setup.environment, null);
		const firstNodeEvents = await service.listEvents(setup.environment, firstNode.id);

		assert.equal(allEvents.length, 4);
		assert.equal(firstNodeEvents.length, 2);
		assert.equal(firstNodeEvents[0]?.node_id, firstNode.id);
		assert.equal(firstNodeEvents[1]?.action, 'set-status');
	} finally {
		await service?.close();
		await fsp.rm(tempDir, { force: true, recursive: true });
	}
});

test('NodeService removes properties and tags and removes nodes', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-node-service-'));
	const setup = sut();
	let service: NodeService | null = null;

	try {
		const created = await setup.create(tempDir);

		service = created.service;

		const node = await service.create(setup.environment, parseNodeCreateValue('1.2.3.4'));

		await service.setProperty(setup.environment, node.id, 'hostname', 'api-1');
		await service.setProperty(setup.environment, node.id, 'os.name', 'ubuntu');

		const added = await service.addTag(setup.environment, node.id, 'MASTER');
		const removedTag = await service.removeTag(setup.environment, node.id, 'MASTER');
		const removedHostname = await service.removeProperty(setup.environment, node.id, 'hostname');
		const removedOsName = await service.removeProperty(setup.environment, node.id, 'os.name');
		const removedNode = await service.remove(setup.environment, node.id);

		assert.equal(added, true);
		assert.equal(removedTag, true);
		assert.deepEqual(removedHostname, { kind: 'ok' });
		assert.deepEqual(removedOsName, { kind: 'ok' });
		assert.equal(removedNode, true);
	} finally {
		await service?.close();
		await fsp.rm(tempDir, { force: true, recursive: true });
	}
});

test('NodeService reuses the same repo until close is called', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-node-service-'));
	const setup = sut();
	const openRepo = vi.spyOn(NodeRepo, 'open');
	let service: NodeService | null = null;

	try {
		const created = await setup.create(tempDir);

		service = created.service;

		await service.list(setup.environment, []);
		await service.get(setup.environment, 'ip-1-2-3-4');

		assert.equal(openRepo.mock.calls.length, 1);

		await service.close();
		await service.list(setup.environment, []);

		assert.equal(openRepo.mock.calls.length, 2);
	} finally {
		await service?.close();
		openRepo.mockRestore();
		await fsp.rm(tempDir, { force: true, recursive: true });
	}
});

class MockNodeSyncService {
	ensureLocalStateCalls: string[];

	constructor() {
		this.ensureLocalStateCalls = [];
	}

	async clear(): Promise<void> {}

	async ensureLocalState(environment: { id: string }): Promise<void> {
		this.ensureLocalStateCalls.push(environment.id);
	}

	async pull(): Promise<void> {}

	async save() {
		return {
			node_count: 0,
		};
	}
}
