import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import { KEY_AGENT_ASKPASS_TTL_MS } from '#src/app/key-agent/key-agent-shapes';

export class SshAskpassSetCommandInput {
	static schema = z.object({
		password: z.string().min(1),
		ttl_seconds: z.int().positive(),
	});

	password: string;
	ttl_seconds: number;

	constructor(fields: unknown) {
		const parsed = SshAskpassSetCommandInput.schema.parse(fields);

		this.password = parsed.password;
		this.ttl_seconds = parsed.ttl_seconds;
	}
}

export function createSshAskpassSetCommand(container: Tiny): Command {
	const command = new Command('set');

	command.argument('<password>');
	command.description('Store an ephemeral SSH askpass value.');
	command.option('--ttl <ttl>', 'Askpass token TTL in seconds.', String(KEY_AGENT_ASKPASS_TTL_MS / 1000));
	command.action(async (password, options) => {
		const scope = container.createScope();

		await handleSshAskpassSetCommand(
			{
				password,
				ttl_seconds: Number(options.ttl),
			},
			scope,
		);
	});

	return command;
}

export async function handleSshAskpassSetCommand(fields: unknown, container: Tiny): Promise<void> {
	const input = new SshAskpassSetCommandInput(fields);
	const keyAgentManager = container.get(KeyAgentManager);
	const token = await keyAgentManager.setAskpass(input.password, input.ttl_seconds * 1000);

	process.stdout.write(token);
}
