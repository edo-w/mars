import assert from 'node:assert/strict';
import { test } from 'vitest';
import { NodeStatus } from '#src/app/node/node-models';
import {
	type PlaybookSshClient,
	type PlaybookSshConnectionOptions,
	type PlaybookSshExecOptions,
	type PlaybookSshExecResult,
	type PlaybookSshIdentity,
	type PlaybookTaskContext,
	PlaybookTaskModel,
	PlaybookTaskStatus,
} from '#src/app/playbook/playbook-models';
import { EchowaitTaskHandler } from '#src/app/playbook/tasks/echowait';

class MockPlaybookSshClient implements PlaybookSshClient {
	commands: string[];
	results: PlaybookSshExecResult[];

	constructor(results: PlaybookSshExecResult[]) {
		this.commands = [];
		this.results = results;
	}

	async close(): Promise<void> {}

	async connect(_options: PlaybookSshConnectionOptions, _identity: PlaybookSshIdentity): Promise<void> {}

	async exec(command: string, _options?: PlaybookSshExecOptions): Promise<PlaybookSshExecResult> {
		this.commands.push(command);

		return (
			this.results.shift() ?? {
				code: 0,
				signal: null,
				stderr: '',
				stdout: '',
			}
		);
	}

	isConnected(): boolean {
		return true;
	}
}

test('EchowaitTaskHandler runs each step over ssh and reports ok', async () => {
	const ssh = new MockPlaybookSshClient([
		{ code: 0, signal: null, stderr: '', stdout: 'do work\n' },
		{ code: 0, signal: null, stderr: '', stdout: 'pretend step2\n' },
	]);
	const progress: Array<{
		message: string | null;
		percent: number | null;
		step: number | null;
		total: number | null;
	}> = [];
	const context: PlaybookTaskContext = {
		emitProgress: (fields) => {
			progress.push(fields);
		},
		environment: {} as never,
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
		ssh,
		task: new PlaybookTaskModel({
			id: 0,
			input: {},
			name: 'bootstrap',
			type: 'echowait',
		}),
	};
	const handler = new EchowaitTaskHandler();
	const result = await handler.run(context, {
		steps: [
			['do work', 10],
			['pretend step2', 5],
		],
	});

	assert.equal(result.status, PlaybookTaskStatus.Ok);
	assert.deepEqual(progress, [
		{ message: 'do work', percent: 50, step: 1, total: 2 },
		{ message: 'pretend step2', percent: 100, step: 2, total: 2 },
	]);
	assert.equal(ssh.commands[0], "printf '%s\\n' 'do work' && sleep 10");
	assert.equal(ssh.commands[1], "printf '%s\\n' 'pretend step2' && sleep 5");
});

test('EchowaitTaskHandler returns fail when a remote step fails', async () => {
	const ssh = new MockPlaybookSshClient([{ code: 1, signal: null, stderr: 'boom', stdout: 'do work\n' }]);
	const context: PlaybookTaskContext = {
		emitProgress: () => {},
		environment: {} as never,
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
		ssh,
		task: new PlaybookTaskModel({
			id: 0,
			input: {},
			name: 'bootstrap',
			type: 'echowait',
		}),
	};
	const handler = new EchowaitTaskHandler();
	const result = await handler.run(context, {
		steps: [['do work', 10]],
	});

	assert.equal(result.status, PlaybookTaskStatus.Fail);
	assert.equal(result.stderr, 'boom');
});
