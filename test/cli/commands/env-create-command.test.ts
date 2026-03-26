import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { createEnvCreateCommand, handleEnvCreateCommand } from '#src/cli/commands/env-create-command';
import { runCommand } from '#test/helpers/command';
import { createCommandScope } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createEnvCreateCommand builds the create command', () => {
	const command = createEnvCreateCommand(new Tiny());

	assert.equal(command.name(), 'create');
	assert.equal(command.description(), 'Create an environment.');
});

test('handleEnvCreateCommand logs when the environment already exists', async () => {
	const container = createCommandScope(EnvironmentService, {
		create: vi.fn(async () => null),
	});

	await handleEnvCreateCommand({ name: 'dev' }, container);

	assert.deepEqual(logger.warning.mock.calls[0], ['environment "dev" already exists']);
});

test('handleEnvCreateCommand logs when the environment is created', async () => {
	const environment = createEnvironment();
	const container = createCommandScope(EnvironmentService, {
		create: vi.fn(async () => environment),
	});

	await handleEnvCreateCommand({ name: 'dev' }, container);

	assert.deepEqual(logger.info.mock.calls[0], ['created environment "gl-dev"']);
});

test('createEnvCreateCommand runs through commander', async () => {
	const create = vi.fn(async () => null);
	const container = createCommandScope(EnvironmentService, {
		create,
	});
	const command = createEnvCreateCommand(container);

	await runCommand(command, ['dev']);

	assert.deepEqual(create.mock.calls[0], ['dev']);
});
