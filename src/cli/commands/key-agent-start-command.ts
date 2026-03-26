import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import { KeyAgentManager } from '#src/cli/app/key-agent/key-agent-manager';

export function createKeyAgentStartCommand(container: Tiny): Command {
	const command = new Command('start');

	command.description('Start the Mars key-agent.');
	command.action(async () => {
		const scope = container.createScope();

		await handleKeyAgentStartCommand(scope);
	});

	return command;
}

export async function handleKeyAgentStartCommand(container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'key-agent', 'start']);
	const keyAgentManager = container.get(KeyAgentManager);
	const result = await keyAgentManager.start();

	if (result.kind === 'running') {
		logger.info(`key-agent running with ${result.key_agent.pid}`);
		return;
	}

	if (result.kind === 'timeout') {
		logger.error('failed to start key-agent. ping timeout');
		return;
	}

	logger.info(`key-agent started with ${result.key_agent.pid}`);
}
