import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { InitService } from '#src/app/init/init-service';

export function createInitCommand(container: Tiny): Command {
	const command = new Command('init');

	command.description('Initialize Mars configuration.');
	command.action(async () => {
		await handleInitCommand(container.createScope());
	});

	return command;
}

export async function handleInitCommand(container: Tiny): Promise<void> {
	const service = container.get(InitService);

	await service.init();
}
