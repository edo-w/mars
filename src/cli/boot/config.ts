import * as z from 'zod';
import type { Vfs } from '#src/lib/vfs';

export const CONFIG_FILE = 'mars.config.json';
export const NAMESPACE = 'app';
export const ENVS_PATH = 'infra/envs';
export const WORK_PATH = '.mars';
export const ENV_BUCKET = '{env}-infra-{aws_account_id}';

export class MarsConfig {
	static schema = z.object({
		namespace: z.string().min(1),
		envs_path: z.string().min(1),
		env_bucket: z.string().min(1).default(ENV_BUCKET),
		work_path: z.string().min(1).default(WORK_PATH),
	});

	namespace: string;
	envs_path: string;
	env_bucket: string;
	work_path: string;

	constructor(fields: unknown) {
		const parsed = MarsConfig.schema.parse(fields);

		this.namespace = parsed.namespace;
		this.envs_path = parsed.envs_path;
		this.env_bucket = parsed.env_bucket;
		this.work_path = parsed.work_path;
	}
}

export function createDefaultMarsConfig(): MarsConfig {
	return new MarsConfig({
		namespace: NAMESPACE,
		envs_path: ENVS_PATH,
		env_bucket: ENV_BUCKET,
		work_path: WORK_PATH,
	});
}

export async function readMarsConfig(vfs: Vfs): Promise<MarsConfig> {
	const configContents = await vfs.readTextFile(CONFIG_FILE);
	const configFields = JSON.parse(configContents) as unknown;

	return new MarsConfig(configFields);
}
