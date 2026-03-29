import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { NodeService } from '#src/cli/app/node/node-service';
import {
	createNodePropertySetCommand,
	handleNodePropertySetCommand,
} from '#src/cli/commands/node-property-set-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createNodePropertySetCommand builds the property set command', () => {
	const command = createNodePropertySetCommand(new Tiny());

	assert.equal(command.name(), 'set');
});

test('handleNodePropertySetCommand sets the property through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const setProperty = vi.fn(async () => 'ubuntu');
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, setProperty }],
	]);

	await handleNodePropertySetCommand(
		{
			env: null,
			id: '1.2.3.4',
			property: 'os.name',
			value: 'ubuntu',
		},
		container,
	);

	assert.equal(setProperty.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createNodePropertySetCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const setProperty = vi.fn(async () => true);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, setProperty }],
	]);
	const command = createNodePropertySetCommand(container);

	await runCommand(command, ['ip-1-2-3-4', 'docker.installed', 'true']);

	assert.equal(setProperty.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
