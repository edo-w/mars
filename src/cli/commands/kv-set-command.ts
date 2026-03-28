import type { Tiny } from '@edo-w/tiny';
import { Command } from 'commander';
import * as z from 'zod';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KvDataType } from '#src/cli/app/kv/kv-models';
import { KvService } from '#src/cli/app/kv/kv-service';
import { Vfs } from '#src/lib/vfs';
import { vlogManager } from '#src/lib/vlogger';

export class KvSetCommandInput {
	static schema = z
		.object({
			env: z.string().min(1).nullable(),
			file_path: z.string().min(1).nullable(),
			input: z.boolean(),
			key_path: z.string().min(1),
			secret: z.boolean(),
			value: z.string().nullable(),
		})
		.superRefine((value, context) => {
			const sourceCount = [value.value !== null, value.file_path !== null, value.input].filter(Boolean).length;

			if (sourceCount !== 1) {
				context.addIssue({
					code: 'custom',
					message: 'set requires exactly one data source',
					path: [],
				});
			}
		});

	env: string | null;
	file_path: string | null;
	input: boolean;
	key_path: string;
	secret: boolean;
	value: string | null;

	constructor(fields: unknown) {
		const parsed = KvSetCommandInput.schema.parse(fields);

		this.env = parsed.env;
		this.file_path = parsed.file_path;
		this.input = parsed.input;
		this.key_path = parsed.key_path;
		this.secret = parsed.secret;
		this.value = parsed.value;
	}
}

export function createKvSetCommand(container: Tiny): Command {
	const command = new Command('set');

	command.description('Set a kv value.');
	command.argument('<key_path>');
	command.option('--env <env>');
	command.option('--secret');
	command.option('--value <data>');
	command.option('--file <path>');
	command.option('--input');
	command.action(async (keyPath, options) => {
		const fields = {
			env: options.env ?? null,
			file_path: options.file ?? null,
			input: options.input === true,
			key_path: keyPath,
			secret: options.secret === true,
			value: options.value ?? null,
		};
		const scope = container.createScope();

		await handleKvSetCommand(fields, scope);
	});

	return command;
}

export async function handleKvSetCommand(fields: unknown, container: Tiny): Promise<void> {
	const logger = vlogManager.getLogger(['mars', 'kv', 'set']);
	let input: KvSetCommandInput;

	try {
		input = new KvSetCommandInput(fields);
	} catch {
		logger.error('invalid kv set input');
		return;
	}

	const environmentService = container.get(EnvironmentService);
	const environment = await environmentService.resolveEnvironment(input.env);

	if (environment === null) {
		if (input.env === null) {
			logger.error('no environment selected');
			return;
		}

		logger.error(`environment "${input.env}" not found`);
		return;
	}

	const valueBytes = await readValueBytes(input, container.get(Vfs));
	const kvService = container.get(KvService);
	const type = input.file_path === null ? KvDataType.Text : KvDataType.File;
	try {
		const result = await kvService.set(environment, {
			data: valueBytes,
			key_path: input.key_path,
			secret: input.secret,
			type,
		});

		logger.info(`set kv "${result.key_path}" version #${result.version_id}`);
	} finally {
		await kvService.close();
	}
}

async function readValueBytes(input: KvSetCommandInput, vfs: Vfs): Promise<Uint8Array> {
	if (input.value !== null) {
		return new TextEncoder().encode(input.value);
	}

	if (input.file_path !== null) {
		return vfs.readFile(input.file_path);
	}

	return readStdin();
}

async function readStdin(): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	let totalLength = 0;

	for await (const chunk of process.stdin) {
		const dataChunk = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : Uint8Array.from(chunk);

		chunks.push(dataChunk);
		totalLength += dataChunk.byteLength;
	}

	const result = new Uint8Array(totalLength);
	let offset = 0;

	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return result;
}
