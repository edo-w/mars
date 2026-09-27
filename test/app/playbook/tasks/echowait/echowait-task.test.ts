import assert from 'node:assert/strict';
import { test } from 'vitest';
import { EchowaitTaskInput, echowait } from '#src/app/playbook/tasks/echowait';

test('echowait creates an echowait playbook task definition', () => {
	const task = echowait('bootstrap', [
		['do work', 10],
		['pretend step2', 5],
	]);

	assert.equal(task.type, 'echowait');
	assert.equal(task.name, 'bootstrap');
	assert.deepEqual(task.input, {
		steps: [
			['do work', 10],
			['pretend step2', 5],
		],
	});
});

test('EchowaitTaskInput requires at least one step', () => {
	assert.throws(() => {
		new EchowaitTaskInput({
			steps: [],
		});
	});
});
