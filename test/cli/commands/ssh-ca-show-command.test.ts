import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { createSshCaShowCommand, handleSshCaShowCommand } from '#src/cli/commands/ssh-ca-show-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createSshCaShowCommand builds the show command', () => {
	const command = createSshCaShowCommand(new Tiny());

	assert.equal(command.name(), 'show');
	assert.equal(command.description(), 'Show SSH certificate authority details.');
});

test('handleSshCaShowCommand logs when the ssh ca is missing', async () => {
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
				show: vi.fn(async () => null),
			},
		],
	]);

	await handleSshCaShowCommand({ env: 'gl-dev', name: 'default' }, container);

	assert.deepEqual(logger.error.mock.calls[0], ['ssh ca "default" does not exists']);
});

test('createSshCaShowCommand passes args through commander', async () => {
	const resolveEnvironment = vi.fn(async () => null);
	const container = createCommandContainer([
		[
			EnvironmentService,
			{
				resolveEnvironment,
			},
		],
	]);
	const command = createSshCaShowCommand(container);

	await runCommand(command, ['default', '--env', 'gl-dev']);

	assert.deepEqual(resolveEnvironment.mock.calls[0], ['gl-dev']);
});
