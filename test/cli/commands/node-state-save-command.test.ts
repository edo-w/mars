import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import { createNodeStateSaveCommand, handleNodeStateSaveCommand } from '#src/cli/commands/node-state-save-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodeStateSaveCommand builds the save command', () => {
	const command = createNodeStateSaveCommand(new Tiny());

	assert.equal(command.name(), 'save');
});

test('handleNodeStateSaveCommand saves node state through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const stateSave = vi.fn(async () => ({ node_count: 1 }));
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, stateSave }],
	]);

	await handleNodeStateSaveCommand(
		{
			env: null,
		},
		container,
	);

	assert.equal(stateSave.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodeStateSaveCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const stateSave = vi.fn(async () => ({ node_count: 0 }));
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, stateSave }],
	]);
	const command = createNodeStateSaveCommand(container);

	await runCommand(command, []);

	assert.equal(stateSave.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
