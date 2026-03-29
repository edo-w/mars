import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import { createNodeTagRemoveCommand, handleNodeTagRemoveCommand } from '#src/cli/commands/node-tag-remove-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodeTagRemoveCommand builds the remove command', () => {
	const command = createNodeTagRemoveCommand(new Tiny());

	assert.equal(command.name(), 'remove');
});

test('handleNodeTagRemoveCommand removes the tag through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const removeTag = vi.fn(async () => true);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, removeTag }],
	]);

	await handleNodeTagRemoveCommand(
		{
			env: null,
			id: '1.2.3.4',
			tag: 'MASTER',
		},
		container,
	);

	assert.equal(removeTag.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodeTagRemoveCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const removeTag = vi.fn(async () => true);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, removeTag }],
	]);
	const command = createNodeTagRemoveCommand(container);

	await runCommand(command, ['ip-1-2-3-4', 'master']);

	assert.equal(removeTag.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
