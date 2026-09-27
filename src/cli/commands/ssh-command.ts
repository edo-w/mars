import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createSshAskpassCommand } from '#src/cli/commands/ssh-askpass-command';
import { createSshCaCommand } from '#src/cli/commands/ssh-ca-command';

export function createSshCommand(container: Tiny): Command {
	const command = new Command('ssh');

	command.description('Manage Mars SSH resources.');
	command.addCommand(createSshAskpassCommand(container));
	command.addCommand(createSshCaCommand(container));

	return command;
}
