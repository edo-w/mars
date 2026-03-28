import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createKvStateCommand } from '#src/cli/commands/kv-state-command';

test('createKvStateCommand builds the kv state command', () => {
	const command = createKvStateCommand(new Tiny());

	assert.equal(command.name(), 'state');
	assert.equal(command.commands.map((child) => child.name()).join(','), 'pull,save,clear');
});
