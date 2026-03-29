import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { InitService } from '#src/app/init/init-service';
import { createInitCommand, handleInitCommand } from '#src/cli/commands/init-command';
import { runCommand } from '#test/helpers/command';
import { createCommandScope } from '#test/helpers/command-container';

test('createInitCommand builds the init command', () => {
	const command = createInitCommand(new Tiny());

	assert.equal(command.name(), 'init');
	assert.equal(command.description(), 'Initialize Mars configuration.');
});

test('handleInitCommand runs the init service', async () => {
	const init = vi.fn(async () => {});
	const container = createCommandScope(InitService, {
		init,
	});

	await handleInitCommand(container);

	assert.equal(init.mock.calls.length, 1);
});

test('createInitCommand runs the init handler through commander', async () => {
	const init = vi.fn(async () => {});
	const container = createCommandScope(InitService, {
		init,
	});
	const command = createInitCommand(container);

	await runCommand(command, []);

	assert.equal(init.mock.calls.length, 1);
});
