import type { Command } from 'commander';

export async function runCommand(command: Command, args: string[]): Promise<void> {
	command.exitOverride();

	await command.parseAsync(args, {
		from: 'user',
	});
}
