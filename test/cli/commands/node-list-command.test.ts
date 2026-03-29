import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeStatus } from '#src/app/node/node-models';
import { NodeService } from '#src/app/node/node-service';
import { createNodeListCommand, handleNodeListCommand } from '#src/cli/commands/node-list-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodeListCommand builds the list command', () => {
	const command = createNodeListCommand(new Tiny());

	assert.equal(command.name(), 'list');
});

test('handleNodeListCommand lists nodes through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const list = vi.fn(async () => [
		{
			hostname: 'api-1',
			id: 'ip-1-2-3-4',
			private_ip: '10.0.0.5',
			public_ip: '1.2.3.4',
			status: NodeStatus.Ready,
			tags: ['master'],
		},
	]);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, list }],
	]);

	await handleNodeListCommand(
		{
			env: null,
			tag: 'MASTER,db',
		},
		container,
	);

	const listCall = list.mock.calls[0] as unknown[] | undefined;

	if (listCall === undefined) {
		throw new Error('expected node list call');
	}

	assert.deepEqual(listCall[1], ['master', 'db']);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodeListCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const list = vi.fn(async () => []);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, list }],
	]);
	const command = createNodeListCommand(container);

	await runCommand(command, ['--tag', 'master,db']);

	assert.equal(list.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
