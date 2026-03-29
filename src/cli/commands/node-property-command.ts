import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createNodePropertyGetCommand } from '#src/cli/commands/node-property-get-command';
import { createNodePropertyRemoveCommand } from '#src/cli/commands/node-property-remove-command';
import { createNodePropertySetCommand } from '#src/cli/commands/node-property-set-command';

export function createNodePropertyCommand(container: Tiny): Command {
	const command = new Command('property');

	command.description('Manage node properties.');
	command.addCommand(createNodePropertySetCommand(container));
	command.addCommand(createNodePropertyGetCommand(container));
	command.addCommand(createNodePropertyRemoveCommand(container));

	return command;
}
