import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createNodeTagAddCommand } from '#src/cli/commands/node-tag-add-command';
import { createNodeTagRemoveCommand } from '#src/cli/commands/node-tag-remove-command';

export function createNodeTagCommand(container: Tiny): Command {
	const command = new Command('tag');

	command.description('Manage node tags.');
	command.addCommand(createNodeTagAddCommand(container));
	command.addCommand(createNodeTagRemoveCommand(container));

	return command;
}
