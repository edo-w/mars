import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { createEnvSelectCommand, handleEnvSelectCommand } from '#src/cli/commands/env-select-command';
import { runCommand } from '#test/helpers/command';
import { createCommandScope } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockTui, withMockTui } from '#test/helpers/tui';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();
const tui = useMockTui();

test('createEnvSelectCommand builds the select command', () => {
	const command = createEnvSelectCommand(new Tiny());

	assert.equal(command.name(), 'select');
	assert.equal(command.description(), 'Select the current environment.');
});

test('handleEnvSelectCommand logs when selecting a missing environment', async () => {
	const container = createCommandScope(EnvironmentService, {
		select: vi.fn(async () => null),
	});

	await handleEnvSelectCommand({ name: 'gl-dev' }, container);

	assert.deepEqual(logger.error.mock.calls[0], ['environment "gl-dev" not found']);
});

test('handleEnvSelectCommand logs when no environments are available for tui selection', async () => {
	const container = withMockTui(
		[
			[
				EnvironmentService,
				{
					list: vi.fn(async () => []),
				},
			],
		],
		tui,
	);

	await handleEnvSelectCommand({ name: null }, container);

	assert.deepEqual(logger.warn.mock.calls[0], ['no environments found']);
});

test('handleEnvSelectCommand selects the environment returned by the tui', async () => {
	const environment = createEnvironment();

	tui.autocomplete.mockResolvedValue('gl-dev');

	const container = withMockTui(
		[
			[
				EnvironmentService,
				{
					list: vi.fn(async () => [environment]),
					select: vi.fn(async () => environment),
				},
			],
		],
		tui,
	);

	await handleEnvSelectCommand({ name: null }, container);

	assert.deepEqual(logger.info.mock.calls[0], ['selected "gl-dev"']);
});

test('createEnvSelectCommand passes the parsed name through commander', async () => {
	const select = vi.fn(async () => null);
	const container = createCommandScope(EnvironmentService, {
		select,
	});
	const command = createEnvSelectCommand(container);

	await runCommand(command, ['gl-dev']);

	assert.deepEqual(select.mock.calls[0], ['gl-dev']);
});
