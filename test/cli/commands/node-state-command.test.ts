import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createNodeStateCommand } from '#src/cli/commands/node-state-command';

test('createNodeStateCommand builds the node state command tree', () => {
	const command = createNodeStateCommand(new Tiny());
	const childNames = command.commands.map((childCommand) => childCommand.name());

	assert.equal(command.name(), 'state');
	assert.deepEqual(childNames, ['pull', 'save', 'clear']);
});
