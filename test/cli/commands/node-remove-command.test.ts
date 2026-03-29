import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import { createNodeRemoveCommand, handleNodeRemoveCommand } from '#src/cli/commands/node-remove-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodeRemoveCommand builds the remove command', () => {
	const command = createNodeRemoveCommand(new Tiny());

	assert.equal(command.name(), 'remove');
	assert.equal(command.alias(), 'rm');
});

test('handleNodeRemoveCommand removes the node through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const remove = vi.fn(async () => true);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, remove }],
	]);

	await handleNodeRemoveCommand(
		{
			env: null,
			id: '1.2.3.4',
		},
		container,
	);

	assert.equal(remove.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodeRemoveCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const remove = vi.fn(async () => false);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, remove }],
	]);
	const command = createNodeRemoveCommand(container);

	await runCommand(command, ['ip-1-2-3-4']);

	assert.equal(remove.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
