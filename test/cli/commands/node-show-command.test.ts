import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeService } from '#src/app/node/node-service';
import { createNodeShowCommand, handleNodeShowCommand } from '#src/cli/commands/node-show-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createNodeShowCommand builds the show command', () => {
	const command = createNodeShowCommand(new Tiny());

	assert.equal(command.name(), 'show');
});

test('handleNodeShowCommand reads the node through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const get = vi.fn(async () => {
		return {
			node: {
				create_date: '2026-03-28T23:11:40.000Z',
				hostname: 'api-1',
				id: 'ip-1-2-3-4',
				private_ip: '10.0.0.5',
				properties: {
					'os.name': 'ubuntu',
					'os.version': '24.04',
				},
				public_ip: '1.2.3.4',
				status: 'new',
				update_date: '2026-03-28T23:11:40.592Z',
			},
			tags: ['master'],
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, get }],
	]);

	await handleNodeShowCommand(
		{
			env: null,
			id: '1.2.3.4',
		},
		container,
	);

	assert.equal(get.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
	assert.deepEqual(
		logger.info.mock.calls.map(([message]) => message),
		[
			'id: ip-1-2-3-4',
			'hostname: api-1',
			'public_ip: 1.2.3.4',
			'private_ip: 10.0.0.5',
			'status: new',
			'create_date: 2026-03-28T23:11:40.000Z',
			'update_date: 2026-03-28T23:11:40.592Z',
			'tags: [master]',
			'properties:',
			'os.name: ubuntu',
			'os.version: 24.04',
		],
	);
});

test('createNodeShowCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const get = vi.fn(async () => null);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, get }],
	]);
	const command = createNodeShowCommand(container);

	await runCommand(command, ['ip-1-2-3-4']);

	assert.equal(get.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
