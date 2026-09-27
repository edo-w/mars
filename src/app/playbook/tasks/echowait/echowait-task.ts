import * as z from 'zod';
import type { PlaybookTaskDefinitionModel } from '#src/app/playbook/playbook-models';
import { createPlaybookTaskDefinition } from '#src/app/playbook/playbook-shapes';

const echowaitTaskStepSchema = z.tuple([z.string().min(1), z.number().nonnegative()]);

export class EchowaitTaskInput {
	static schema = z.object({
		steps: z.array(echowaitTaskStepSchema).min(1),
	});

	steps: Array<[string, number]>;

	constructor(fields: unknown) {
		const parsed = EchowaitTaskInput.schema.parse(fields);

		this.steps = parsed.steps;
	}
}

export function echowait(name: string, steps: Array<[string, number]>): PlaybookTaskDefinitionModel {
	const input = new EchowaitTaskInput({
		steps,
	});

	return createPlaybookTaskDefinition('echowait', name, {
		steps: input.steps,
	});
}
