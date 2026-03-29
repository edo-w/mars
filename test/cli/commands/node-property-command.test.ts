import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createNodePropertyCommand } from '#src/cli/commands/node-property-command';

test('createNodePropertyCommand builds the node property command tree', () => {
	const command = createNodePropertyCommand(new Tiny());
	const childNames = command.commands.map((childCommand) => childCommand.name());

	assert.equal(command.name(), 'property');
	assert.deepEqual(childNames, ['set', 'get', 'rm']);
});
