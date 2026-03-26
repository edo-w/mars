import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { createSshCaCreateCommand, handleSshCaCreateCommand } from '#src/cli/commands/ssh-ca-create-command';
import { runCommand } from '#test/helpers/command';
import { createEnvironment } from '#test/helpers/environment';
import { useMockTui, withMockTui } from '#test/helpers/tui';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();
const tui = useMockTui();

test('createSshCaCreateCommand builds the create command', () => {
	const command = createSshCaCreateCommand(new Tiny());

	assert.equal(command.name(), 'create');
	assert.equal(command.description(), 'Create an SSH certificate authority.');
});

test('handleSshCaCreateCommand logs invalid passphrase input', async () => {
	const environment = createEnvironment();

	tui.password.mockResolvedValue('');

	const container = withMockTui(
		[
			[
				EnvironmentService,
				{
					resolveEnvironment: vi.fn(async () => environment),
				},
			],
			[
				SshCaService,
				{
					create: vi.fn(),
				},
			],
		],
		tui,
	);

	await handleSshCaCreateCommand({ env: 'gl-dev', name: 'default' }, container);

	assert.deepEqual(logger.error.mock.calls[0], ['invalid ssh ca passphrase']);
});

test('createSshCaCreateCommand passes args through commander', async () => {
	const resolveEnvironment = vi.fn(async () => null);

	tui.password.mockResolvedValue('secret');

	const container = withMockTui(
		[
			[
				EnvironmentService,
				{
					resolveEnvironment,
				},
			],
		],
		tui,
	);
	const command = createSshCaCreateCommand(container);

	await runCommand(command, ['default', '--env', 'gl-dev']);

	assert.deepEqual(resolveEnvironment.mock.calls[0], ['gl-dev']);
});
