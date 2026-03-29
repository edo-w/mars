import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { BackendFactory } from '#src/app/backend/backend-factory';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { SecretsProviderFactory } from '#src/app/secrets/secrets-provider-factory';
import { createEnvShowCommand, handleEnvShowCommand } from '#src/cli/commands/env-show-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer, createCommandScope } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createEnvShowCommand builds the show command', () => {
	const command = createEnvShowCommand(new Tiny());

	assert.equal(command.name(), 'show');
	assert.equal(command.description(), 'Show environment details.');
});

test('handleEnvShowCommand logs when no environment is selected', async () => {
	const container = createCommandScope(EnvironmentService, {
		getCurrent: vi.fn(async () => null),
	});

	await handleEnvShowCommand({ name: null }, container);

	assert.deepEqual(logger.warn.mock.calls[0], ['no environment selected']);
});

test('handleEnvShowCommand logs environment details', async () => {
	const environment = createEnvironment();
	const container = createCommandContainer([
		[
			EnvironmentService,
			{
				get: vi.fn(async () => environment),
			},
		],
		[
			BackendFactory,
			{
				create: vi.fn(async () => {
					return {
						getInfo: vi.fn(async () => {
							return {
								fields: [{ name: 'env_bucket', value: 'bucket' }],
								type: 's3',
							};
						}),
					};
				}),
			},
		],
		[
			SecretsProviderFactory,
			{
				create: vi.fn(async () => {
					return {
						getInfo: vi.fn(async () => {
							return {
								fields: [{ name: 'kms_key_alias', value: 'alias/mars' }],
								type: 'kms',
							};
						}),
					};
				}),
			},
		],
	]);

	await handleEnvShowCommand({ name: 'gl-dev' }, container);

	assert.equal(
		logger.info.mock.calls.some((call) => call[0] === 'backend:'),
		true,
	);
	assert.equal(
		logger.info.mock.calls.some((call) => call[0] === 'secrets:'),
		true,
	);
});

test('createEnvShowCommand normalizes the missing name to null through commander', async () => {
	const getCurrent = vi.fn(async () => null);
	const container = createCommandScope(EnvironmentService, {
		getCurrent,
	});
	const command = createEnvShowCommand(container);

	await runCommand(command, []);

	assert.deepEqual(getCurrent.mock.calls[0], []);
});
