import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { SshCaService } from '#src/app/ssh-ca/ssh-ca-service';
import { DEFAULT_SSH_CA_NAME } from '#src/app/ssh-ca/ssh-ca-shapes';
import { vlogManager } from '#src/lib/vlogger';

export class SshCaPullCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		name: z.string().min(1).nullable(),
	});

	env: string | null;
	name: string | null;

	constructor(fields: unknown) {
		const parsed = SshCaPullCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.name = parsed.name;
	}
}

export function createSshCaPullCommand(container: Tiny): Command {
	const command = new Command('pull');

	command.description('Pull an SSH certificate authority locally.');
	command.argument('[name]');
	command.option('--env <env>');
	command.action(async (name, options) => {
		const fields = {
			env: options.env ?? null,
			name: name ?? null,
		};
		const scope = container.createScope();

		await handleSshCaPullCommand(fields, scope);
	});

	return command;
}

export async function handleSshCaPullCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'ssh', 'ca', 'pull']);
	let input: SshCaPullCommandInput;

	try {
		input = new SshCaPullCommandInput(fields);
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
	const result = await sshCaService.pull(environment, name);

	switch (result.kind) {
		case 'corrupted': {
			logger.error(`ssh ca "${result.name}" corrupted. the following files missing in s3`);

			for (const missingFile of result.missing_files) {
				logger.error(`- ${missingFile}`);
			}

			return;
		}

		case 'not_found': {
			logger.error(`ssh ca "${result.name}" does not exists`);
			return;
		}

		case 'pulled': {
			logger.info(`pulled ssh ca "${result.ssh_ca.name}"`);
		}
	}
}
