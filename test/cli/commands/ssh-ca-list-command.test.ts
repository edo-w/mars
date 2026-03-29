import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { SshCaService } from '#src/app/ssh-ca/ssh-ca-service';
import { createSshCaListCommand, handleSshCaListCommand } from '#src/cli/commands/ssh-ca-list-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createSshCaListCommand builds the list command', () => {
	const command = createSshCaListCommand(new Tiny());

	assert.equal(command.name(), 'list');
	assert.equal(command.description(), 'List SSH certificate authorities.');
});

test('handleSshCaListCommand logs ssh ca names', async () => {
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
				list: vi.fn(async () => ['default', 'deploy']),
			},
		],
	]);

	await handleSshCaListCommand({ env: 'gl-dev' }, container);

	assert.deepEqual(logger.info.mock.calls[0], ['default']);
	assert.deepEqual(logger.info.mock.calls[1], ['deploy']);
});

test('createSshCaListCommand passes the env option through commander', async () => {
	const resolveEnvironment = vi.fn(async () => null);
	const container = createCommandContainer([
		[
			EnvironmentService,
			{
				resolveEnvironment,
			},
		],
	]);
	const command = createSshCaListCommand(container);

	await runCommand(command, ['--env', 'gl-dev']);

	assert.deepEqual(resolveEnvironment.mock.calls[0], ['gl-dev']);
});
