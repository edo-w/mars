import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import { KeyAgentManager } from '#src/cli/app/key-agent/key-agent-manager';

export function createKeyAgentShowCommand(container: Tiny): Command {
	const command = new Command('show');

	command.description('Show the current key-agent status.');
	command.action(async () => {
		const scope = container.createScope();

		await handleKeyAgentShowCommand(scope);
	});

	return command;
}

export async function handleKeyAgentShowCommand(container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'key-agent', 'show']);
	const keyAgentManager = container.get(KeyAgentManager);
	const result = await keyAgentManager.show();

	if (result.kind === 'stopped') {
		logger.info('key-agent not running');
		return;
	}

	logger.info(`pid: ${result.key_agent.pid}`);
	logger.info(`socket: ${result.key_agent.socket}`);
}
