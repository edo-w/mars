import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createEnvBootstrapCommand } from '#src/cli/commands/env-bootstrap-command';
import { createEnvCreateCommand } from '#src/cli/commands/env-create-command';
import { createEnvDestroyCommand } from '#src/cli/commands/env-destroy-command';
import { createEnvListCommand } from '#src/cli/commands/env-list-command';
import { createEnvSelectCommand } from '#src/cli/commands/env-select-command';
import { createEnvShowCommand } from '#src/cli/commands/env-show-command';

export function createEnvCommand(container: Tiny): Command {
	const command = new Command('env');

	command.description('Manage Mars environments.');
	command.addCommand(createEnvListCommand(container));
	command.addCommand(createEnvShowCommand(container));
	command.addCommand(createEnvCreateCommand(container));
	command.addCommand(createEnvSelectCommand(container));
	command.addCommand(createEnvBootstrapCommand(container));
	command.addCommand(createEnvDestroyCommand(container));

	return command;
}
