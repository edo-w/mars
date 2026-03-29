import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeStatus } from '#src/cli/app/node/node-models';
import { NodeService } from '#src/cli/app/node/node-service';
import { createNodeSetStatusCommand, handleNodeSetStatusCommand } from '#src/cli/commands/node-set-status-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodeSetStatusCommand builds the set-status command', () => {
	const command = createNodeSetStatusCommand(new Tiny());

	assert.equal(command.name(), 'set-status');
});

test('handleNodeSetStatusCommand sets node status through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const setStatus = vi.fn(async () => ({
		status: NodeStatus.Ready,
	}));
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, setStatus }],
	]);

	await handleNodeSetStatusCommand(
		{
			env: null,
			id: '1.2.3.4',
			status: 'ready',
		},
		container,
	);

	assert.equal(setStatus.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodeSetStatusCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const setStatus = vi.fn(async () => null);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, setStatus }],
	]);
	const command = createNodeSetStatusCommand(container);

	await runCommand(command, ['ip-1-2-3-4', 'ready']);

	assert.equal(setStatus.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
