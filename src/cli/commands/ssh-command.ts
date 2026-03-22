import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createSshCaCommand } from '#src/cli/commands/ssh-ca-command';

export function createSshCommand(container: Tiny): Command {
	const command = new Command('ssh');

	command.description('Manage Mars SSH resources.');
	command.addCommand(createSshCaCommand(container));

	return command;
}
