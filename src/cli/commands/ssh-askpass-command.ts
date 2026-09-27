import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createSshAskpassClearCommand } from '#src/cli/commands/ssh-askpass-clear-command';
import { createSshAskpassGetCommand } from '#src/cli/commands/ssh-askpass-get-command';
import { createSshAskpassSetCommand } from '#src/cli/commands/ssh-askpass-set-command';

export function createSshAskpassCommand(container: Tiny): Command {
	const command = new Command('askpass');

	command.description('Internal SSH askpass bridge.');
	command.addCommand(createSshAskpassSetCommand(container));
	command.addCommand(createSshAskpassGetCommand(container));
	command.addCommand(createSshAskpassClearCommand(container));

	return command;
}
