import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';

export class SshAskpassClearCommandInput {
	static schema = z.object({
		token: z.string().min(1),
	});

	token: string;

	constructor(fields: unknown) {
		const parsed = SshAskpassClearCommandInput.schema.parse(fields);

		this.token = parsed.token;
	}
}

export function createSshAskpassClearCommand(container: Tiny): Command {
	const command = new Command('clear');

	command.argument('<token>');
	command.description('Clear an ephemeral SSH askpass value.');
	command.action(async (token) => {
		const scope = container.createScope();

		await handleSshAskpassClearCommand(
			{
				token,
			},
			scope,
		);
	});

	return command;
}

export async function handleSshAskpassClearCommand(fields: unknown, container: Tiny): Promise<void> {
	const input = new SshAskpassClearCommandInput(fields);
	const keyAgentManager = container.get(KeyAgentManager);

	await keyAgentManager.clearAskpass(input.token);
}
