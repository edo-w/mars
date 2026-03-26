import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { BackendBootstrapperFactory } from '#src/cli/app/backend/backend-bootstrapper-factory';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SecretsBootstrapperFactory } from '#src/cli/app/secrets/secrets-bootstrapper-factory';
import { createEnvBootstrapCommand, handleEnvBootstrapCommand } from '#src/cli/commands/env-bootstrap-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer, createCommandScope } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createEnvBootstrapCommand builds the bootstrap command', () => {
	const command = createEnvBootstrapCommand(new Tiny());

	assert.equal(command.name(), 'bootstrap');
	assert.equal(command.description(), 'Bootstrap the Mars environment backend and secrets.');
});

test('handleEnvBootstrapCommand logs missing selected environment', async () => {
	const container = createCommandScope(EnvironmentService, {
		resolveEnvironment: vi.fn(async () => null),
	});

	await handleEnvBootstrapCommand({ env: null }, container);

	assert.deepEqual(logger.error.mock.calls[0], ['no environment selected']);
});

test('handleEnvBootstrapCommand logs backend and secrets bootstrap results', async () => {
	const environment = createEnvironment();
	const container = createCommandContainer([
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
						bootstrap: vi.fn(async () => {
							return {
								kind: 'created',
								resource_label: 's3 bucket "bucket"',
							};
						}),
					};
				}),
			},
		],
		[
			SecretsBootstrapperFactory,
			{
				create: vi.fn(async () => {
					return {
						bootstrap: vi.fn(async () => {
							return {
								kind: 'already_exists',
								resource_label: 'kms key "alias/mars"',
							};
						}),
					};
				}),
			},
		],
	]);

	await handleEnvBootstrapCommand({ env: 'gl-dev' }, container);

	assert.equal(
		logger.info.mock.calls.some((call) => call[0] === 'created s3 bucket "bucket"'),
		true,
	);
	assert.equal(
		logger.info.mock.calls.some((call) => call[0] === 'kms key "alias/mars" already exists'),
		true,
	);
});

test('createEnvBootstrapCommand passes the env option through commander', async () => {
	const resolveEnvironment = vi.fn(async () => null);
	const container = createCommandScope(EnvironmentService, {
		resolveEnvironment,
	});
	const command = createEnvBootstrapCommand(container);

	await runCommand(command, ['--env', 'gl-dev']);

	assert.deepEqual(resolveEnvironment.mock.calls[0], ['gl-dev']);
});
