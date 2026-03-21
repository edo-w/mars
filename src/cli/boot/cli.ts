import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { createEnvCommand } from '#src/cli/commands/env-command';
import { createInitCommand } from '#src/cli/commands/init-command';

export function createProgram(container: Tiny): Command {
	const program = new Command();

	program.name('mars');
	program.description('Mars CLI');
	program.addCommand(createInitCommand(container));
	program.addCommand(createEnvCommand(container));

	return program;
}
