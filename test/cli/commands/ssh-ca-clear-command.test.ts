import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { createSshCaClearCommand, handleSshCaClearCommand } from '#src/cli/commands/ssh-ca-clear-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createSshCaClearCommand builds the clear command', () => {
	const command = createSshCaClearCommand(new Tiny());

	assert.equal(command.name(), 'clear');
	assert.equal(command.description(), 'Clear a local SSH certificate authority.');
});

test('handleSshCaClearCommand logs when the local ssh ca is cleared', async () => {
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

	await handleSshCaClearCommand({ env: 'gl-dev', name: 'default' }, container);

	assert.deepEqual(logger.info.mock.calls[0], ['cleared local ssh ca "default"']);
});

test('createSshCaClearCommand passes args through commander', async () => {
	const resolveEnvironment = vi.fn(async () => null);
	const container = createCommandContainer([
		[
			EnvironmentService,
			{
				resolveEnvironment,
			},
		],
	]);
	const command = createSshCaClearCommand(container);

	await runCommand(command, ['default', '--env', 'gl-dev']);

	assert.deepEqual(resolveEnvironment.mock.calls[0], ['gl-dev']);
});
