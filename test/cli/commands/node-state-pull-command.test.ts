import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import { createNodeStatePullCommand, handleNodeStatePullCommand } from '#src/cli/commands/node-state-pull-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodeStatePullCommand builds the pull command', () => {
	const command = createNodeStatePullCommand(new Tiny());

	assert.equal(command.name(), 'pull');
});

test('handleNodeStatePullCommand pulls node state through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const statePull = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, statePull }],
	]);

	await handleNodeStatePullCommand(
		{
			env: null,
		},
		container,
	);

	assert.equal(statePull.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodeStatePullCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const statePull = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, statePull }],
	]);
	const command = createNodeStatePullCommand(container);

	await runCommand(command, []);

	assert.equal(statePull.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
