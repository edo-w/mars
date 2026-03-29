import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import { createNodeTagAddCommand, handleNodeTagAddCommand } from '#src/cli/commands/node-tag-add-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodeTagAddCommand builds the add command', () => {
	const command = createNodeTagAddCommand(new Tiny());

	assert.equal(command.name(), 'add');
});

test('handleNodeTagAddCommand adds the tag through the node service', async () => {
	const environment = createEnvironment();
	const addTag = vi.fn(async () => true);
	const close = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { addTag, close }],
	]);

	await handleNodeTagAddCommand(
		{
			env: null,
			id: '1.2.3.4',
			tag: 'MASTER',
		},
		container,
	);

	assert.equal(addTag.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodeTagAddCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const addTag = vi.fn(async () => true);
	const close = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { addTag, close }],
	]);
	const command = createNodeTagAddCommand(container);

	await runCommand(command, ['ip-1-2-3-4', 'master']);

	assert.equal(addTag.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
