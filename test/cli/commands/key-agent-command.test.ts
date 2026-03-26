import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createKeyAgentCommand } from '#src/cli/commands/key-agent-command';

test('createKeyAgentCommand builds the key-agent subcommands', () => {
	const command = createKeyAgentCommand(new Tiny());
	const subcommands = command.commands.map((entry) => entry.name());

	assert.equal(command.name(), 'key-agent');
	assert.deepEqual(subcommands, ['ping', 'show', 'start', 'stop', 'serve']);
});
