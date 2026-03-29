import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createNodeEventListCommand } from '#src/cli/commands/node-event-list-command';

export function createNodeEventCommand(container: Tiny): Command {
	const command = new Command('event');

	command.description('Inspect node events.');
	command.addCommand(createNodeEventListCommand(container));

	return command;
}
