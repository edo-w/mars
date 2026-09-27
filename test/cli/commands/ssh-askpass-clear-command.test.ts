import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import {
	createSshAskpassClearCommand,
	handleSshAskpassClearCommand,
} from '#src/cli/commands/ssh-askpass-clear-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';

test('createSshAskpassClearCommand builds the ssh askpass clear command', () => {
	const command = createSshAskpassClearCommand(new Tiny());

	assert.equal(command.name(), 'clear');
});

test('handleSshAskpassClearCommand clears the askpass token', async () => {
	const clearAskpass = vi.fn(async () => {});
	const container = createCommandContainer([[KeyAgentManager, { clearAskpass }]]);

	await handleSshAskpassClearCommand(
		{
			token: 'token',
		},
		container,
	);

	assert.deepEqual(clearAskpass.mock.calls[0], ['token']);
});

test('createSshAskpassClearCommand normalizes commander values', async () => {
	const clearAskpass = vi.fn(async () => {});
	const container = createCommandContainer([[KeyAgentManager, { clearAskpass }]]);
	const command = createSshAskpassClearCommand(container);

	await runCommand(command, ['token']);

	assert.deepEqual(clearAskpass.mock.calls[0], ['token']);
});
