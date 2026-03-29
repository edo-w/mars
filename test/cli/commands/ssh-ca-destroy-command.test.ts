import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { SshCaService } from '#src/app/ssh-ca/ssh-ca-service';
import { createSshCaDestroyCommand, handleSshCaDestroyCommand } from '#src/cli/commands/ssh-ca-destroy-command';
import { runCommand } from '#test/helpers/command';
import { createEnvironment } from '#test/helpers/environment';
import { useMockTui, withMockTui } from '#test/helpers/tui';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();
const tui = useMockTui();

test('createSshCaDestroyCommand builds the destroy command', () => {
	const command = createSshCaDestroyCommand(new Tiny());

	assert.equal(command.name(), 'destroy');
	assert.equal(command.description(), 'Destroy an SSH certificate authority.');
});

test('handleSshCaDestroyCommand logs invalid confirmation names', async () => {
	const environment = createEnvironment();

	tui.input.mockResolvedValue('wrong');

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
					describeDestroy: vi.fn(async () => [{ label: 's3://bucket/key' }]),
				},
			],
		],
		tui,
	);

	await handleSshCaDestroyCommand({ env: 'gl-dev', name: 'default' }, container);

	assert.deepEqual(logger.error.mock.calls[0], ['invalid ssh ca name']);
});

test('createSshCaDestroyCommand passes args through commander', async () => {
	const resolveEnvironment = vi.fn(async () => null);

	tui.input.mockResolvedValue('default');

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
	const command = createSshCaDestroyCommand(container);

	await runCommand(command, ['default', '--env', 'gl-dev']);

	assert.deepEqual(resolveEnvironment.mock.calls[0], ['gl-dev']);
});
