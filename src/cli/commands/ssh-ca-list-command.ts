import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';

export class SshCaListCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
	});

	env: string | null;

	constructor(fields: unknown) {
		const parsed = SshCaListCommandInput.schema.parse(fields);

		this.env = parsed.env;
	}
}

export function createSshCaListCommand(container: Tiny): Command {
	const command = new Command('list');

	command.description('List SSH certificate authorities.');
	command.option('--env <env>');
	command.action(async (options) => {
		const fields = {
			env: options.env ?? null,
		};
		const scope = container.createScope();

		await handleSshCaListCommand(fields, scope);
	});

	return command;
}

export async function handleSshCaListCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'ssh', 'ca', 'list']);
	let input: SshCaListCommandInput;

	try {
		input = new SshCaListCommandInput(fields);
	} catch {
		logger.error('invalid environment name');
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
	const sshCaNames = await sshCaService.list(environment);

	for (const sshCaName of sshCaNames) {
		logger.info(sshCaName);
	}
}
