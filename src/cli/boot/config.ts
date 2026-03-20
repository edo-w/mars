import * as z from 'zod';

export const CONFIG_FILE = 'mars.config.json';
export const STACK_PATH = 'infra/stacks';
export const WORK_PATH = '.mars';

export class MarsConfig {
	static schema = z.object({
		stack_path: z.string().min(1),
		work_path: z.string().min(1).default(WORK_PATH),
	});

	stack_path: string;
	work_path: string;

	constructor(fields: unknown) {
		const parsed = MarsConfig.schema.parse(fields);

		this.stack_path = parsed.stack_path;
		this.work_path = parsed.work_path;
	}
}

export function createDefaultMarsConfig(): MarsConfig {
	return new MarsConfig({
		stack_path: STACK_PATH,
		work_path: WORK_PATH,
	});
}
