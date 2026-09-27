import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';

export class SshAskpassGetCommandInput {
	static schema = z.object({
		token: z.string().min(1),
	});

	token: string;

	constructor(fields: unknown) {
		const parsed = SshAskpassGetCommandInput.schema.parse(fields);

		this.token = parsed.token;
	}
}

export function createSshAskpassGetCommand(container: Tiny): Command {
	const command = new Command('get');

	command.argument('<token>');
	command.description('Get an ephemeral SSH askpass value.');
	command.action(async (token) => {
		const scope = container.createScope();

		await handleSshAskpassGetCommand(
			{
				token,
			},
			scope,
		);
	});

	return command;
}

export async function handleSshAskpassGetCommand(fields: unknown, container: Tiny): Promise<void> {
	const input = new SshAskpassGetCommandInput(fields);
	const keyAgentManager = container.get(KeyAgentManager);
	const password = await keyAgentManager.getAskpass(input.token);

	process.stdout.write(password);
}
