import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { SshCaService } from '#src/app/ssh-ca/ssh-ca-service';
import { createSshCaPullCommand, handleSshCaPullCommand } from '#src/cli/commands/ssh-ca-pull-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createSshCaPullCommand builds the pull command', () => {
	const command = createSshCaPullCommand(new Tiny());

	assert.equal(command.name(), 'pull');
	assert.equal(command.description(), 'Pull an SSH certificate authority locally.');
});

test('handleSshCaPullCommand logs corrupted ssh ca state', async () => {
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
				pull: vi.fn(async () => {
					return {
						kind: 'corrupted' as const,
						missing_files: ['a', 'b'],
						name: 'default',
					};
				}),
			},
		],
	]);

	await handleSshCaPullCommand({ env: 'gl-dev', name: 'default' }, container);

	assert.deepEqual(logger.error.mock.calls[0], ['ssh ca "default" corrupted. the following files missing in s3']);
});

test('createSshCaPullCommand passes args through commander', async () => {
	const resolveEnvironment = vi.fn(async () => null);
	const container = createCommandContainer([
		[
			EnvironmentService,
			{
				resolveEnvironment,
			},
		],
	]);
	const command = createSshCaPullCommand(container);

	await runCommand(command, ['default', '--env', 'gl-dev']);

	assert.deepEqual(resolveEnvironment.mock.calls[0], ['gl-dev']);
});
