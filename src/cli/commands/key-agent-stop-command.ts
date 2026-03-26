import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import { KeyAgentManager } from '#src/cli/app/key-agent/key-agent-manager';

export function createKeyAgentStopCommand(container: Tiny): Command {
	const command = new Command('stop');

	command.description('Stop the Mars key-agent.');
	command.action(async () => {
		const scope = container.createScope();

		await handleKeyAgentStopCommand(scope);
	});

	return command;
}

export async function handleKeyAgentStopCommand(container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'key-agent', 'stop']);
	const keyAgentManager = container.get(KeyAgentManager);
	const result = await keyAgentManager.stop();

	if (result.kind === 'not_running') {
		logger.info('key-agent not running');
		return;
	}

	logger.info(`stopping key-agent ${result.key_agent.pid}`);
}
