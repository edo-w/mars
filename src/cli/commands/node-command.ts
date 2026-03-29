import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createNodeCreateCommand } from '#src/cli/commands/node-create-command';
import { createNodeEventCommand } from '#src/cli/commands/node-event-command';
import { createNodeListCommand } from '#src/cli/commands/node-list-command';
import { createNodePropertyCommand } from '#src/cli/commands/node-property-command';
import { createNodeRemoveCommand } from '#src/cli/commands/node-remove-command';
import { createNodeSetStatusCommand } from '#src/cli/commands/node-set-status-command';
import { createNodeShowCommand } from '#src/cli/commands/node-show-command';
import { createNodeStateCommand } from '#src/cli/commands/node-state-command';
import { createNodeTagCommand } from '#src/cli/commands/node-tag-command';

export function createNodeCommand(container: Tiny): Command {
	const command = new Command('node');

	command.description('Manage the Mars environment node inventory.');
	command.addCommand(createNodeCreateCommand(container));
	command.addCommand(createNodeShowCommand(container));
	command.addCommand(createNodeListCommand(container));
	command.addCommand(createNodeRemoveCommand(container));
	command.addCommand(createNodeSetStatusCommand(container));
	command.addCommand(createNodeEventCommand(container));
	command.addCommand(createNodePropertyCommand(container));
	command.addCommand(createNodeTagCommand(container));
	command.addCommand(createNodeStateCommand(container));

	return command;
}
