import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import { createSshAskpassGetCommand, handleSshAskpassGetCommand } from '#src/cli/commands/ssh-askpass-get-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';

test('createSshAskpassGetCommand builds the ssh askpass get command', () => {
	const command = createSshAskpassGetCommand(new Tiny());

	assert.equal(command.name(), 'get');
});

test('handleSshAskpassGetCommand writes the askpass value to stdout', async () => {
	const getAskpass = vi.fn(async () => 'secret');
	const originalWrite = process.stdout.write;
	const write = vi.fn(() => true);
	const container = createCommandContainer([[KeyAgentManager, { getAskpass }]]);

	try {
		process.stdout.write = write as never;
		await handleSshAskpassGetCommand(
			{
				token: 'token',
			},
			container,
		);
	} finally {
		process.stdout.write = originalWrite;
	}

	assert.equal(getAskpass.mock.calls.length, 1);
	const writeCall = write.mock.calls[0] as unknown[] | undefined;

	assert.equal(writeCall?.[0], 'secret');
});

test('createSshAskpassGetCommand normalizes commander values', async () => {
	const getAskpass = vi.fn(async () => 'secret');
	const originalWrite = process.stdout.write;
	const write = vi.fn(() => true);
	const container = createCommandContainer([[KeyAgentManager, { getAskpass }]]);
	const command = createSshAskpassGetCommand(container);

	try {
		process.stdout.write = write as never;
		await runCommand(command, ['token']);
	} finally {
		process.stdout.write = originalWrite;
	}

	const call = getAskpass.mock.calls[0] as unknown[] | undefined;

	assert.equal(call?.[0], 'token');
});
