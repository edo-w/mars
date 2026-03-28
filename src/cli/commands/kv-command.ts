import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createKvGetCommand } from '#src/cli/commands/kv-get-command';
import { createKvListCommand } from '#src/cli/commands/kv-list-command';
import { createKvRemoveCommand } from '#src/cli/commands/kv-remove-command';
import { createKvSetCommand } from '#src/cli/commands/kv-set-command';
import { createKvShowCommand } from '#src/cli/commands/kv-show-command';
import { createKvStateCommand } from '#src/cli/commands/kv-state-command';

export function createKvCommand(container: Tiny): Command {
	const command = new Command('kv');

	command.description('Manage the Mars environment kv store.');
	command.addCommand(createKvSetCommand(container));
	command.addCommand(createKvGetCommand(container));
	command.addCommand(createKvShowCommand(container));
	command.addCommand(createKvListCommand(container));
	command.addCommand(createKvRemoveCommand(container));
	command.addCommand(createKvStateCommand(container));

	return command;
}
