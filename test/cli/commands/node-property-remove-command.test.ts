import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import {
	createNodePropertyRemoveCommand,
	handleNodePropertyRemoveCommand,
} from '#src/cli/commands/node-property-remove-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodePropertyRemoveCommand builds the property rm command', () => {
	const command = createNodePropertyRemoveCommand(new Tiny());

	assert.equal(command.name(), 'rm');
});

test('handleNodePropertyRemoveCommand removes the property through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const removeProperty = vi.fn(async () => ({
		kind: 'ok',
	}));
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, removeProperty }],
	]);

	await handleNodePropertyRemoveCommand(
		{
			env: null,
			id: '1.2.3.4',
			property: 'os.name',
		},
		container,
	);

	assert.equal(removeProperty.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodePropertyRemoveCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const removeProperty = vi.fn(async () => ({
		kind: 'property_not_found',
	}));
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, removeProperty }],
	]);
	const command = createNodePropertyRemoveCommand(container);

	await runCommand(command, ['ip-1-2-3-4', 'os.name']);

	assert.equal(removeProperty.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
