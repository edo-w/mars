import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';

export function createEnvListCommand(container: Tiny): Command {
	const command = new Command('list');

	command.description('List Mars environments.');
	command.action(async () => {
		await handleEnvListCommand(container.createScope());
	});

	return command;
}

export async function handleEnvListCommand(container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'env', 'list']);
	const service = container.get(EnvironmentService);
	const environments = await service.list();

	if (environments.length === 0) {
		logger.info('no environments found');
		return;
	}

	const labels = environments.map((environment) => {
		return `${environment.selected ? '*' : ' '} ${environment.id}`;
	});
	const columnWidth = Math.max(...labels.map((label) => label.length));

	for (const [index, environment] of environments.entries()) {
		const label = labels[index] ?? `${environment.selected ? '*' : ' '} ${environment.id}`;
		const row = `${label.padEnd(columnWidth)} ${environment.configPath}`;

		logger.info(row);
	}
}
