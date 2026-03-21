import * as z from 'zod';

export class MarsState {
	static schema = z.object({
		selected_environment: z.string().min(1).nullable(),
	});

	selected_environment: string | null;

	constructor(fields: unknown) {
		const parsed = MarsState.schema.parse(fields);

		this.selected_environment = parsed.selected_environment;
	}
}

export function createDefaultMarsState(): MarsState {
	return new MarsState({
		selected_environment: null,
	});
}
