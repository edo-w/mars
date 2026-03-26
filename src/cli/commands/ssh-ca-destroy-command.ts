import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { Tui } from '#src/lib/tui';
import { vlogManager } from '#src/lib/vlogger';

export class SshCaDestroyCommandInput {
	static schema = z.object({
		env: z.string().min(1).nullable(),
		name: z.string().min(1),
	});

	env: string | null;
	name: string;

	constructor(fields: unknown) {
		const parsed = SshCaDestroyCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.name = parsed.name;
	}
}

export function createSshCaDestroyCommand(container: Tiny): Command {
	const command = new Command('destroy');

	command.description('Destroy an SSH certificate authority.');
	command.argument('<name>');
	command.option('--env <env>');
	command.action(async (name, options) => {
		const fields = {
			env: options.env ?? null,
			name,
		};
		const scope = container.createScope();

		await handleSshCaDestroyCommand(fields, scope);
	});

	return command;
}

export async function handleSshCaDestroyCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'ssh', 'ca', 'destroy']);
	let input: SshCaDestroyCommandInput;

	try {
		input = new SshCaDestroyCommandInput(fields);
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
	const resources = await sshCaService.describeDestroy(environment, input.name);

	if (resources === null) {
		logger.error(`ssh ca "${input.name}" not found`);
		return;
	}

	logger.warning(`you are about to delete the ssh ca "${input.name}"\n\nthe following resources will be destroyed`);

	for (const resource of resources) {
		logger.info(`- ${resource.label}`);
	}

	const tui = container.get(Tui);
	const confirmation = await tui.input('\nto confirm please enter the ssh ca name');

	if (confirmation !== input.name) {
		logger.error('invalid ssh ca name');
		return;
	}

	const result = await sshCaService.destroy(environment, input.name);

	switch (result.kind) {
		case 'destroyed': {
			logger.info(`destroyed ssh ca "${input.name}"`);
			return;
		}

		case 'not_found': {
			logger.error(`ssh ca "${result.name}" not found`);
		}
	}
}
