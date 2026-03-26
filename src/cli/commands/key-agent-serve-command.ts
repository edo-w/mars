import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import { ConfigService } from '#src/cli/app/config/config-service';
import { KeyAgentManager } from '#src/cli/app/key-agent/key-agent-manager';
import { KeyAgentServer } from '#src/cli/app/key-agent/key-agent-server';
import { configureKeyAgentLogging } from '#src/cli/boot/logging';
import { Vfs } from '#src/lib/vfs';

export function createKeyAgentServeCommand(container: Tiny): Command {
	const command = new Command('serve');

	command.description('Run the Mars key-agent service.');
	command.action(async () => {
		const scope = container.createScope();

		await handleKeyAgentServeCommand(scope);
	});

	return command;
}

export async function handleKeyAgentServeCommand(container: Tiny): Promise<void> {
	const configService = container.get(ConfigService);
	const vfs = container.get(Vfs);
	const config = await configService.get();
	const keyAgentLogPath = vfs.resolve(config.work_path, 'key-agent.log');

	await vfs.ensureDirectory(config.work_path);
	await configureKeyAgentLogging(keyAgentLogPath);

	const keyAgentManager = container.get(KeyAgentManager);
	const currentKeyAgent = await keyAgentManager.show();

	if (currentKeyAgent.kind === 'running') {
		return;
	}

	const keyAgentServer = container.get(KeyAgentServer);
	await keyAgentServer.serveAndWaitForClose();
	process.exit(0);
}
