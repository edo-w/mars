import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { SshCaService } from '#src/app/ssh-ca/ssh-ca-service';
import { createSshCaCreateCommand, handleSshCaCreateCommand } from '#src/cli/commands/ssh-ca-create-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createSshCaCreateCommand builds the create command', () => {
	const command = createSshCaCreateCommand(new Tiny());

	assert.equal(command.name(), 'create');
	assert.equal(command.description(), 'Create an SSH certificate authority.');
});

test('handleSshCaCreateCommand creates the ssh ca through the service', async () => {
	const environment = createEnvironment();
	const create = vi.fn(async () => {
		return {
			kind: 'created' as const,
			ssh_ca: {
				create_date: new Date('2026-03-28T00:00:00.000Z'),
				name: 'default',
				private_key: 'backend://private',
				public_key: 'backend://public',
			},
		};
	});

	const container = createCommandContainer([
		[
			EnvironmentService,
			{
				resolveEnvironment: vi.fn(async () => environment),
			},
		],
		[
			SshCaService,
			{
				create,
			},
		],
	]);

	await handleSshCaCreateCommand({ env: 'gl-dev', name: 'default' }, container);

	assert.deepEqual(create.mock.calls[0], [environment, 'default']);
	assert.deepEqual(logger.info.mock.calls[0], ['created ssh ca "default"']);
});

test('createSshCaCreateCommand passes args through commander', async () => {
	const resolveEnvironment = vi.fn(async () => null);
	const container = createCommandContainer([
		[
			EnvironmentService,
			{
				resolveEnvironment,
			},
		],
	]);
	const command = createSshCaCreateCommand(container);

	await runCommand(command, ['default', '--env', 'gl-dev']);

	assert.deepEqual(resolveEnvironment.mock.calls[0], ['gl-dev']);
});
