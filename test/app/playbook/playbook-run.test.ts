import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { EnvironmentConfig } from '#src/app/environment/environment-shapes';
import { NodeStatus } from '#src/app/node/node-models';
import { definePlaybook, selectNodes } from '#src/app/playbook/playbook-api';
import {
	type PlaybookSshClient,
	type PlaybookSshConnectionOptions,
	type PlaybookSshExecOptions,
	type PlaybookSshExecResult,
	type PlaybookSshIdentity,
	type PlaybookTaskContext,
	type PlaybookTaskResultModel,
	PlaybookTaskResultModel as PlaybookTaskResultRecord,
	PlaybookTaskStatus,
} from '#src/app/playbook/playbook-models';
import { PlaybookRun } from '#src/app/playbook/playbook-run';
import { createPlaybookTaskDefinition } from '#src/app/playbook/playbook-shapes';
import { PlaybookSshClientFactory } from '#src/app/playbook/playbook-ssh-client';
import type { PlaybookTaskHandler } from '#src/app/playbook/playbook-task-handler';
import { PlaybookTaskHandlerFactory } from '#src/app/playbook/playbook-task-handler-factory';
import { PlaybookTaskRegistry } from '#src/app/playbook/playbook-task-registry';

class FakePlaybookSshClient implements PlaybookSshClient {
	closeCount: number;
	connectCount: number;
	connected: boolean;

	constructor() {
		this.closeCount = 0;
		this.connectCount = 0;
		this.connected = false;
	}

	async close(): Promise<void> {
		this.closeCount += 1;
		this.connected = false;
	}

	async connect(_options: PlaybookSshConnectionOptions, _identity: PlaybookSshIdentity): Promise<void> {
		this.connectCount += 1;
		this.connected = true;
	}

	async exec(_command: string, _options?: PlaybookSshExecOptions): Promise<PlaybookSshExecResult> {
		return {
			code: 0,
			signal: null,
			stderr: '',
			stdout: '',
		};
	}

	isConnected(): boolean {
		return this.connected;
	}
}

class FakePlaybookSshClientFactory extends PlaybookSshClientFactory {
	clients: FakePlaybookSshClient[];

	constructor() {
		super();
		this.clients = [];
	}

	override create(): PlaybookSshClient {
		const client = new FakePlaybookSshClient();

		this.clients.push(client);

		return client;
	}
}

class MockTaskHandler implements PlaybookTaskHandler {
	async run(context: PlaybookTaskContext, input: Record<string, unknown>): Promise<PlaybookTaskResultModel> {
		const failNodeId = typeof input.fail_node_id === 'string' ? input.fail_node_id : null;
		const changeNodeId = typeof input.change_node_id === 'string' ? input.change_node_id : null;
		const status =
			context.node.id === failNodeId
				? PlaybookTaskStatus.Fail
				: context.node.id === changeNodeId
					? PlaybookTaskStatus.Change
					: PlaybookTaskStatus.Ok;

		return new PlaybookTaskResultRecord({
			message: null,
			ok: status === PlaybookTaskStatus.Ok || status === PlaybookTaskStatus.Change,
			output: null,
			status,
			stderr: '',
			stdout: '',
		});
	}
}

test('PlaybookRun executes tasks in waves and skips failed nodes later', async () => {
	const container = new Tiny();
	const registry = new PlaybookTaskRegistry();
	const sshClientFactory = new FakePlaybookSshClientFactory();
	const environmentConfig = new EnvironmentConfig({
		aws_account_id: '123',
		aws_region: 'us-east-1',
		name: 'dev',
		namespace: 'gl',
	});
	const environment = {
		config: environmentConfig,
		configPath: 'infra/envs/dev/environment.yml',
		directoryPath: 'infra/envs/dev',
		id: environmentConfig.id,
		selected: false,
	};
	const playbook = definePlaybook({
		name: 'bootstrap',
		targets: selectNodes({
			tags: ['web'],
		}),
		tasks: [
			createPlaybookTaskDefinition('mock', 'prepare', {
				change_node_id: 'ip-1-1-1-1',
				fail_node_id: 'ip-2-2-2-2',
			}),
			createPlaybookTaskDefinition('mock', 'verify'),
		],
	});

	container.addScopedClass(MockTaskHandler, []);
	registry.register('mock', MockTaskHandler);

	const run = new PlaybookRun(
		environment,
		playbook,
		[
			{
				node: {
					create_date: '2026-03-28T00:00:00.000Z',
					hostname: null,
					id: 'ip-1-1-1-1',
					private_ip: null,
					properties: {},
					public_ip: '1.1.1.1',
					status: NodeStatus.New,
					update_date: '2026-03-28T00:00:00.000Z',
				},
				tags: ['web'],
			},
			{
				node: {
					create_date: '2026-03-28T00:00:00.000Z',
					hostname: null,
					id: 'ip-2-2-2-2',
					private_ip: null,
					properties: {},
					public_ip: '2.2.2.2',
					status: NodeStatus.New,
					update_date: '2026-03-28T00:00:00.000Z',
				},
				tags: ['web'],
			},
		],
		{
			certificate: 'CERT',
			private_key: 'KEY',
		},
		sshClientFactory,
		new PlaybookTaskHandlerFactory(container, registry),
	);
	const result = await run.result();
	const firstWave = result.task_results[0];
	const secondWave = result.task_results[1];

	assert.equal(firstWave?.node_results.find((item) => item.node_id === 'ip-1-1-1-1')?.status, 'change');
	assert.equal(firstWave?.node_results.find((item) => item.node_id === 'ip-2-2-2-2')?.status, 'fail');
	assert.equal(secondWave?.node_results.find((item) => item.node_id === 'ip-2-2-2-2')?.status, 'skip');
	assert.deepEqual(result.change_node_ids, ['ip-1-1-1-1']);
	assert.deepEqual(result.fail_node_ids, ['ip-2-2-2-2']);
	assert.equal(sshClientFactory.clients[0]?.connectCount, 1);
	assert.equal(sshClientFactory.clients[1]?.connectCount, 1);
});
