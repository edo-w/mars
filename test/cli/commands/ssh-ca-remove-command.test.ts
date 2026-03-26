import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { createSshCaRemoveCommand, handleSshCaRemoveCommand } from '#src/cli/commands/ssh-ca-remove-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createSshCaRemoveCommand builds the remove command', () => {
	const command = createSshCaRemoveCommand(new Tiny());

	assert.equal(command.name(), 'remove');
	assert.equal(command.description(), 'Remove a local SSH certificate authority.');
});

test('handleSshCaRemoveCommand logs when the local ssh ca is removed', async () => {
	const environment = createEnvironment();
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
				remove: vi.fn(async () => true),
			},
		],
	]);

	await handleSshCaRemoveCommand({ env: 'gl-dev', name: 'default' }, container);

	assert.deepEqual(logger.info.mock.calls[0], ['removed local ssh ca "default"']);
});

test('createSshCaRemoveCommand passes args through commander', async () => {
	const resolveEnvironment = vi.fn(async () => null);
	const container = createCommandContainer([
		[
			EnvironmentService,
			{
				resolveEnvironment,
			},
		],
	]);
	const command = createSshCaRemoveCommand(container);

	await runCommand(command, ['default', '--env', 'gl-dev']);

	assert.deepEqual(resolveEnvironment.mock.calls[0], ['gl-dev']);
});
