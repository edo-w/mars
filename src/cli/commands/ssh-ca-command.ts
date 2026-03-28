import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createSshCaClearCommand } from '#src/cli/commands/ssh-ca-clear-command';
import { createSshCaCreateCommand } from '#src/cli/commands/ssh-ca-create-command';
import { createSshCaDestroyCommand } from '#src/cli/commands/ssh-ca-destroy-command';
import { createSshCaListCommand } from '#src/cli/commands/ssh-ca-list-command';
import { createSshCaPullCommand } from '#src/cli/commands/ssh-ca-pull-command';
import { createSshCaShowCommand } from '#src/cli/commands/ssh-ca-show-command';

export function createSshCaCommand(container: Tiny): Command {
	const command = new Command('ca');

	command.description('Manage SSH certificate authorities.');
	command.addCommand(createSshCaListCommand(container));
	command.addCommand(createSshCaShowCommand(container));
	command.addCommand(createSshCaCreateCommand(container));
	command.addCommand(createSshCaDestroyCommand(container));
	command.addCommand(createSshCaPullCommand(container));
	command.addCommand(createSshCaClearCommand(container));

	return command;
}
