import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import { createSshAskpassSetCommand, handleSshAskpassSetCommand } from '#src/cli/commands/ssh-askpass-set-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';

test('createSshAskpassSetCommand builds the ssh askpass set command', () => {
	const command = createSshAskpassSetCommand(new Tiny());

	assert.equal(command.name(), 'set');
});

test('handleSshAskpassSetCommand writes the askpass token to stdout', async () => {
	const setAskpass = vi.fn(async () => 'token');
	const originalWrite = process.stdout.write;
	const write = vi.fn(() => true);
	const container = createCommandContainer([[KeyAgentManager, { setAskpass }]]);

	try {
		process.stdout.write = write as never;
		await handleSshAskpassSetCommand(
			{
				password: 'secret',
				ttl_seconds: 30,
			},
			container,
		);
	} finally {
		process.stdout.write = originalWrite;
	}

	assert.deepEqual(setAskpass.mock.calls[0], ['secret', 30_000]);
	assert.equal((write.mock.calls[0] as unknown[] | undefined)?.[0], 'token');
});

test('createSshAskpassSetCommand normalizes commander values', async () => {
	const setAskpass = vi.fn(async () => 'token');
	const originalWrite = process.stdout.write;
	const write = vi.fn(() => true);
	const container = createCommandContainer([[KeyAgentManager, { setAskpass }]]);
	const command = createSshAskpassSetCommand(container);

	try {
		process.stdout.write = write as never;
		await runCommand(command, ['secret', '--ttl', '45']);
	} finally {
		process.stdout.write = originalWrite;
	}

	assert.deepEqual(setAskpass.mock.calls[0], ['secret', 45_000]);
});
