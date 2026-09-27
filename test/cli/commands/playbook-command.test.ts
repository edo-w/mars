import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test } from 'vitest';
import { createPlaybookCommand } from '#src/cli/commands/playbook-command';

test('createPlaybookCommand builds the playbook command', () => {
	const command = createPlaybookCommand(new Tiny());

	assert.equal(command.name(), 'playbook');
});
