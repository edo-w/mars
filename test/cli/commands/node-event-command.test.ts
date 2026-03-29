import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createNodeEventCommand } from '#src/cli/commands/node-event-command';

test('createNodeEventCommand builds the event command tree', () => {
	const command = createNodeEventCommand(new Tiny());
	const childNames = command.commands.map((childCommand) => childCommand.name());

	assert.equal(command.name(), 'event');
	assert.deepEqual(childNames, ['list']);
});
