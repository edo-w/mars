import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createNodeStateClearCommand } from '#src/cli/commands/node-state-clear-command';
import { createNodeStatePullCommand } from '#src/cli/commands/node-state-pull-command';
import { createNodeStateSaveCommand } from '#src/cli/commands/node-state-save-command';

export function createNodeStateCommand(container: Tiny): Command {
	const command = new Command('state');

	command.description('Manage the local node store state.');
	command.addCommand(createNodeStatePullCommand(container));
	command.addCommand(createNodeStateSaveCommand(container));
	command.addCommand(createNodeStateClearCommand(container));

	return command;
}
