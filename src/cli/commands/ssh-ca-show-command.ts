import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { DEFAULT_SSH_CA_NAME } from '#src/cli/app/ssh-ca/ssh-ca-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class SshCaShowCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		name: z.string().min(1).nullable(),
	});

	env: string | null;
	name: string | null;

	constructor(fields: unknown) {
		const parsed = SshCaShowCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.name = parsed.name;
	}
}

export function createSshCaShowCommand(container: Tiny): Command {
	const command = new Command('show');

	command.description('Show SSH certificate authority details.');
	command.argument('[name]');
	command.option('--env <env>');
	command.action(async (name, options) => {
		const fields = {
			env: options.env ?? null,
			name: name ?? null,
		};
		const scope = container.createScope();

		await handleSshCaShowCommand(fields, scope);
	});

	return command;
}

export async function handleSshCaShowCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'ssh', 'ca', 'show']);
	let input: SshCaShowCommandInput;

	try {
		input = new SshCaShowCommandInput(fields);
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

	const name = input.name ?? DEFAULT_SSH_CA_NAME;
	const sshCaService = container.get(SshCaService);
	const sshCa = await sshCaService.show(environment, name);

	if (sshCa === null) {
		logger.error(`ssh ca "${name}" does not exists`);
		return;
	}

	logger.info(`name: ${sshCa.name}`);
	logger.info(`public_key: ${sshCa.public_key}`);
	logger.info(`private_key: ${sshCa.private_key}`);
	logger.info(`create_date: ${sshCa.create_date.toISOString()}`);
}
