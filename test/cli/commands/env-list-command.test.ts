import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { createEnvListCommand, handleEnvListCommand } from '#src/cli/commands/env-list-command';
import { runCommand } from '#test/helpers/command';
import { createCommandScope } from '#test/helpers/command-container';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createEnvListCommand builds the list command', () => {
	const command = createEnvListCommand(new Tiny());

	assert.equal(command.name(), 'list');
	assert.equal(command.description(), 'List Mars environments.');
});

test('handleEnvListCommand logs when no environments are found', async () => {
	const container = createCommandScope(EnvironmentService, {
		list: vi.fn(async () => []),
	});

	await handleEnvListCommand(container);

	assert.deepEqual(logger.info.mock.calls[0], ['no environments found']);
});

test('handleEnvListCommand logs the environment rows', async () => {
	const container = createCommandScope(EnvironmentService, {
		list: vi.fn(async () => [
			{
				configPath: 'infra/envs/dev/environment.yml',
				id: 'gl-dev',
				selected: true,
			},
			{
				configPath: 'infra/envs/test/environment.yml',
				id: 'gl-test',
				selected: false,
			},
		]),
	});

	await handleEnvListCommand(container);

	assert.equal(logger.info.mock.calls.length, 2);
	assert.equal(logger.info.mock.calls[0]?.[0]?.includes('gl-dev'), true);
	assert.equal(logger.info.mock.calls[1]?.[0]?.includes('gl-test'), true);
});

test('createEnvListCommand runs through commander', async () => {
	const list = vi.fn(async () => []);
	const container = createCommandScope(EnvironmentService, {
		list,
	});
	const command = createEnvListCommand(container);

	await runCommand(command, []);

	assert.equal(list.mock.calls.length, 1);
});
