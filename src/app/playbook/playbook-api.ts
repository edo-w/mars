import type { PlaybookModel, PlaybookTargetSelectorModel } from '#src/app/playbook/playbook-models';
import {
	type CreatePlaybookFields,
	createPlaybookModel,
	createPlaybookTargetSelector,
} from '#src/app/playbook/playbook-shapes';

export { echowait } from '#src/app/playbook/tasks/echowait';

export function definePlaybook(fields: CreatePlaybookFields): PlaybookModel {
	return createPlaybookModel(fields);
}

export function selectNodes(fields: { tags: string[] }): PlaybookTargetSelectorModel {
	return createPlaybookTargetSelector(fields.tags);
}
