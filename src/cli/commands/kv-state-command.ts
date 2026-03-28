import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createKvStateClearCommand } from '#src/cli/commands/kv-state-clear-command';
import { createKvStatePullCommand } from '#src/cli/commands/kv-state-pull-command';
import { createKvStateSaveCommand } from '#src/cli/commands/kv-state-save-command';

export function createKvStateCommand(container: Tiny): Command {
	const command = new Command('state');

	command.description('Manage the local Mars kv state.');
	command.addCommand(createKvStatePullCommand(container));
	command.addCommand(createKvStateSaveCommand(container));
	command.addCommand(createKvStateClearCommand(container));

	return command;
}
