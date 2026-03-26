import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createKeyAgentPingCommand } from '#src/cli/commands/key-agent-ping-command';
import { createKeyAgentServeCommand } from '#src/cli/commands/key-agent-serve-command';
import { createKeyAgentShowCommand } from '#src/cli/commands/key-agent-show-command';
import { createKeyAgentStartCommand } from '#src/cli/commands/key-agent-start-command';
import { createKeyAgentStopCommand } from '#src/cli/commands/key-agent-stop-command';

export function createKeyAgentCommand(container: Tiny): Command {
	const command = new Command('key-agent');

	command.description('Manage the Mars key agent.');
	command.addCommand(createKeyAgentPingCommand(container));
	command.addCommand(createKeyAgentShowCommand(container));
	command.addCommand(createKeyAgentStartCommand(container));
	command.addCommand(createKeyAgentStopCommand(container));
	command.addCommand(createKeyAgentServeCommand(container));

	return command;
}
