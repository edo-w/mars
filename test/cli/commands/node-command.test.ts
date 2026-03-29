import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createNodeCommand } from '#src/cli/commands/node-command';

test('createNodeCommand builds the node command tree', () => {
	const command = createNodeCommand(new Tiny());
	const childNames = command.commands.map((childCommand) => childCommand.name());

	assert.equal(command.name(), 'node');
	assert.deepEqual(childNames, [
		'create',
		'show',
		'list',
		'remove',
		'set-status',
		'event',
		'property',
		'tag',
		'state',
	]);
});
