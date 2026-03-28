import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createSshCaCommand } from '#src/cli/commands/ssh-ca-command';

test('createSshCaCommand builds the ssh ca subcommands', () => {
	const command = createSshCaCommand(new Tiny());
	const subcommands = command.commands.map((entry) => entry.name());

	assert.equal(command.name(), 'ca');
	assert.deepEqual(subcommands, ['list', 'show', 'create', 'destroy', 'pull', 'clear']);
});
