import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createEnvCommand } from '#src/cli/commands/env-command';

test('createEnvCommand builds the env subcommands', () => {
	const command = createEnvCommand(new Tiny());
	const subcommands = command.commands.map((entry) => entry.name());

	assert.equal(command.name(), 'env');
	assert.deepEqual(subcommands, ['list', 'show', 'create', 'select', 'bootstrap', 'destroy']);
});
