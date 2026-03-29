import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import {
	createNodePropertyGetCommand,
	handleNodePropertyGetCommand,
} from '#src/cli/commands/node-property-get-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodePropertyGetCommand builds the property get command', () => {
	const command = createNodePropertyGetCommand(new Tiny());

	assert.equal(command.name(), 'get');
});

test('handleNodePropertyGetCommand reads the property through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const getProperty = vi.fn(async () => ({
		kind: 'ok',
		value: 'ubuntu',
	}));
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, getProperty }],
	]);

	await handleNodePropertyGetCommand(
		{
			env: null,
			id: '1.2.3.4',
			property: 'os.name',
		},
		container,
	);

	assert.equal(getProperty.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodePropertyGetCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const getProperty = vi.fn(async () => ({
		kind: 'property_not_found',
	}));
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, getProperty }],
	]);
	const command = createNodePropertyGetCommand(container);

	await runCommand(command, ['ip-1-2-3-4', 'os.name']);

	assert.equal(getProperty.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
