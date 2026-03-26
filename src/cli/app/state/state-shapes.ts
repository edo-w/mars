import * as z from 'zod';

export class KeyAgentState {
	static schema = z.object({
		pid: z.number().int().positive(),
		socket: z.string().min(1),
		token: z.string().min(1),
	});

	pid: number;
	socket: string;
	token: string;

	constructor(fields: unknown) {
		const parsed = KeyAgentState.schema.parse(fields);

		this.pid = parsed.pid;
		this.socket = parsed.socket;
		this.token = parsed.token;
	}
}

export class MarsState {
	static schema = z.object({
		key_agent: KeyAgentState.schema.nullable().default(null),
		selected_environment: z.string().min(1).nullable(),
	});

	key_agent: KeyAgentState | null;
	selected_environment: string | null;

	constructor(fields: unknown) {
		const parsed = MarsState.schema.parse(fields);

		this.key_agent = parsed.key_agent === null ? null : new KeyAgentState(parsed.key_agent);
		this.selected_environment = parsed.selected_environment;
	}
}

export function createDefaultMarsState(): MarsState {
	return new MarsState({
		key_agent: null,
		selected_environment: null,
	});
}
