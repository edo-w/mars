import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { SshCaService } from '#src/app/ssh-ca/ssh-ca-service';
import { vlogManager } from '#src/lib/vlogger';

export class SshCaClearCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		name: z.string().min(1),
	});

	env: string | null;
	name: string;

	constructor(fields: unknown) {
		const parsed = SshCaClearCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.name = parsed.name;
	}
}

export function createSshCaClearCommand(container: Tiny): Command {
	const command = new Command('clear');

	command.description('Clear a local SSH certificate authority.');
	command.argument('<name>');
	command.option('--env <env>');
	command.action(async (name, options) => {
		const fields = {
			env: options.env ?? null,
			name,
		};
		const scope = container.createScope();

		await handleSshCaClearCommand(fields, scope);
	});

	return command;
}

export async function handleSshCaClearCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'ssh', 'ca', 'clear']);
	let input: SshCaClearCommandInput;

	try {
		input = new SshCaClearCommandInput(fields);
	} catch {
		logger.error('invalid ssh ca name');
		return;
	}

	const environmentService = container.get(EnvironmentService);
	const environment = await environmentService.resolveEnvironment(input.env);

	if (environment === null) {
		if (input.env === null) {
			logger.error('no environment selected');
			return;
		}

		logger.error(`environment "${input.env}" does not exists`);
		return;
	}

	const sshCaService = container.get(SshCaService);
	const cleared = await sshCaService.remove(environment, input.name);

	if (cleared) {
		logger.info(`cleared local ssh ca "${input.name}"`);
	}
}
