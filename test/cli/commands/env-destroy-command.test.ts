import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { BackendBootstrapperFactory } from '#src/cli/app/backend/backend-bootstrapper-factory';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SecretsBootstrapperFactory } from '#src/cli/app/secrets/secrets-bootstrapper-factory';
import { createEnvDestroyCommand, handleEnvDestroyCommand } from '#src/cli/commands/env-destroy-command';
import { runCommand } from '#test/helpers/command';
import { createEnvironment } from '#test/helpers/environment';
import { useMockTui, withMockTui } from '#test/helpers/tui';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();
const tui = useMockTui();

test('createEnvDestroyCommand builds the destroy command', () => {
	const command = createEnvDestroyCommand(new Tiny());

	assert.equal(command.name(), 'destroy');
	assert.equal(command.description(), 'Destroy Mars-managed environment resources.');
});

test('handleEnvDestroyCommand logs invalid confirmation', async () => {
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
				BackendBootstrapperFactory,
				{
					create: vi.fn(async () => {
						return {
							describeDestroy: vi.fn(async () => [{ label: 's3 bucket "bucket"', status: 'destroy' }]),
						};
					}),
				},
			],
			[
				SecretsBootstrapperFactory,
				{
					create: vi.fn(async () => {
						return {
							describeDestroy: vi.fn(async () => []),
						};
					}),
				},
			],
		],
		tui,
	);

	await handleEnvDestroyCommand({ env: 'gl-dev' }, container);

	assert.deepEqual(logger.error.mock.calls[0], ['invalid environment id']);
});

test('createEnvDestroyCommand passes the env option through commander', async () => {
	const resolveEnvironment = vi.fn(async () => null);
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
	const command = createEnvDestroyCommand(container);

	await runCommand(command, ['--env', 'gl-dev']);

	assert.deepEqual(resolveEnvironment.mock.calls[0], ['gl-dev']);
});
