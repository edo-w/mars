import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createKvCommand } from '#src/cli/commands/kv-command';

test('createKvCommand builds the kv command', () => {
	const command = createKvCommand(new Tiny());

	assert.equal(command.name(), 'kv');
	assert.equal(command.commands.map((child) => child.name()).join(','), 'set,get,show,list,remove,state');
});
