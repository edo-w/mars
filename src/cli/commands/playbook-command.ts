import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createPlaybookRunCommand } from '#src/cli/commands/playbook-run-command';

export function createPlaybookCommand(container: Tiny): Command {
	const command = new Command('playbook');

	command.description('Run Mars playbooks across nodes.');
	command.addCommand(createPlaybookRunCommand(container));

	return command;
}
