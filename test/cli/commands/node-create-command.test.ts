import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import { createNodeCreateCommand, handleNodeCreateCommand } from '#src/cli/commands/node-create-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodeCreateCommand builds the create command', () => {
	const command = createNodeCreateCommand(new Tiny());

	assert.equal(command.name(), 'create');
});

test('handleNodeCreateCommand stores the node through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const create = vi.fn(async () => {
		return {
			id: 'ip-1-2-3-4',
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, create }],
	]);

	await handleNodeCreateCommand(
		{
			env: null,
			public_ip_or_id: '1.2.3.4',
		},
		container,
	);

	assert.equal(create.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodeCreateCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const create = vi.fn(async () => {
		return {
			id: 'ip-1-2-3-4',
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, create }],
	]);
	const command = createNodeCreateCommand(container);

	await runCommand(command, ['1.2.3.4']);

	assert.equal(create.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
