import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';

export class SshCaRemoveCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		name: z.string().min(1),
	});

	env: string | null;
	name: string;

	constructor(fields: unknown) {
		const parsed = SshCaRemoveCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.name = parsed.name;
	}
}

export function createSshCaRemoveCommand(container: Tiny): Command {
	const command = new Command('remove');

	command.alias('rm');
	command.description('Remove a local SSH certificate authority.');
	command.argument('<name>');
	command.option('--env <env>');
	command.action(async (name, options) => {
		const fields = {
			env: options.env ?? null,
			name,
		};
		const scope = container.createScope();

		await handleSshCaRemoveCommand(fields, scope);
	});

	return command;
}

export async function handleSshCaRemoveCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'ssh', 'ca', 'remove']);
	let input: SshCaRemoveCommandInput;

	try {
		input = new SshCaRemoveCommandInput(fields);
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
	const removed = await sshCaService.remove(environment, input.name);

	if (removed) {
		logger.info(`removed local ssh ca "${input.name}"`);
	}
}
