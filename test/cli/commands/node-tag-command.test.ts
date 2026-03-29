import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createNodeTagCommand } from '#src/cli/commands/node-tag-command';

test('createNodeTagCommand builds the node tag command tree', () => {
	const command = createNodeTagCommand(new Tiny());
	const childNames = command.commands.map((childCommand) => childCommand.name());

	assert.equal(command.name(), 'tag');
	assert.deepEqual(childNames, ['add', 'remove']);
});
