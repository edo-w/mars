import assert from 'node:assert/strict';
import { test } from 'vitest';
import { definePlaybook, echowait, selectNodes } from '#src/app/playbook/playbook-api';

test('definePlaybook assigns task ids from task order', () => {
	const playbook = definePlaybook({
		name: 'bootstrap',
		targets: selectNodes({
			tags: ['web'],
		}),
		tasks: [echowait('first', [['step 1', 1]]), echowait('second', [['step 2', 2]])],
	});

	assert.equal(playbook.tasks[0]?.id, 0);
	assert.equal(playbook.tasks[1]?.id, 1);
	assert.equal(playbook.tasks[0]?.type, 'echowait');
	assert.equal(playbook.targets.tags[0], 'web');
});
