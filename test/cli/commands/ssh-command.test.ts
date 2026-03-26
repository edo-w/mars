import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createSshCommand } from '#src/cli/commands/ssh-command';

test('createSshCommand builds the ssh command tree', () => {
	const command = createSshCommand(new Tiny());

	assert.equal(command.name(), 'ssh');
	assert.deepEqual(
		command.commands.map((entry) => entry.name()),
		['ca'],
	);
});
