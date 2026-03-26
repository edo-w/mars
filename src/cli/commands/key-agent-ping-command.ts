import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { KeyAgentManager } from '#src/cli/app/key-agent/key-agent-manager';
import { vlogManager } from '#src/lib/vlogger';

export function createKeyAgentPingCommand(container: Tiny): Command {
	const command = new Command('ping');

	command.description('Ping the current Mars key-agent.');
	command.action(async () => {
		const scope = container.createScope();

		await handleKeyAgentPingCommand(scope);
	});

	return command;
}

export async function handleKeyAgentPingCommand(container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'key-agent', 'ping']);
	const keyAgentManager = container.get(KeyAgentManager);
	const result = await keyAgentManager.ping();

	if (result.kind === 'not_running') {
		logger.info('key-agent is not running');
		return;
	}

	if (result.kind === 'failed') {
		logger.error(`ping failed: ${result.error}`);
		return;
	}

	logger.info('ping sucessfully');
}
