import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import { createNodeStateClearCommand, handleNodeStateClearCommand } from '#src/cli/commands/node-state-clear-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodeStateClearCommand builds the clear command', () => {
	const command = createNodeStateClearCommand(new Tiny());

	assert.equal(command.name(), 'clear');
});

test('handleNodeStateClearCommand clears node state through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const stateClear = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, stateClear }],
	]);

	await handleNodeStateClearCommand(
		{
			env: null,
		},
		container,
	);

	assert.equal(stateClear.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodeStateClearCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const stateClear = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, stateClear }],
	]);
	const command = createNodeStateClearCommand(container);

	await runCommand(command, []);

	assert.equal(stateClear.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
