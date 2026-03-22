import type { Tiny } from '@edo-w/tiny';
import { getLogger } from '@logtape/logtape';
import { Command } from 'commander';
import Enquirer from 'enquirer';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { DEFAULT_SSH_CA_NAME } from '#src/cli/app/ssh-ca/ssh-ca-shapes';

export class SshCaCreateCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		name: z.string().min(1).nullable(),
	});

	env: string | null;
	name: string | null;

	constructor(fields: unknown) {
		const parsed = SshCaCreateCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.name = parsed.name;
	}
}

export function createSshCaCreateCommand(container: Tiny): Command {
	const command = new Command('create');

	command.description('Create an SSH certificate authority.');
	command.argument('[name]');
	command.option('--env <env>');
	command.action(async (name, options) => {
		const fields = {
			env: options.env ?? null,
			name: name ?? null,
		};
		const scope = container.createScope();

		await handleSshCaCreateCommand(fields, scope);
	});

	return command;
}

export async function handleSshCaCreateCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = getLogger(['mars', 'ssh', 'ca', 'create']);
	let input: SshCaCreateCommandInput;

	try {
		input = new SshCaCreateCommandInput(fields);
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

	const passphrase = await promptForPassphrase();

	if (passphrase === null || passphrase.length === 0) {
		logger.error('invalid ssh ca passphrase');
		return;
	}

	const name = input.name ?? DEFAULT_SSH_CA_NAME;
	const sshCaService = container.get(SshCaService);
	const result = await sshCaService.create(environment, name, passphrase);

	switch (result.kind) {
		case 'already_exists': {
			logger.error(`ssh ca "${result.name}" already exists`);
			return;
		}

		case 'created': {
			logger.info(`created ssh ca "${result.ssh_ca.name}"`);
		}
	}
}

async function promptForPassphrase(): Promise<string | null> {
	try {
		const result = await Enquirer.prompt<{ passphrase: string }>({
			message: 'enter ssh ca passphrase',
			name: 'passphrase',
			type: 'password',
		});

		return result.passphrase;
	} catch {
		return null;
	}
}
