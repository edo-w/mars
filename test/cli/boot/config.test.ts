import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createDefaultMarsConfig, MarsConfig, WORK_PATH } from '#src/cli/boot/config';

test('MarsConfig constructs from valid input', () => {
	const record = new MarsConfig({
		stack_path: 'infra/stacks',
		work_path: '.mars',
	});

	assert.equal(record.stack_path, 'infra/stacks');
	assert.equal(record.work_path, '.mars');
});

test('MarsConfig defaults work_path when omitted', () => {
	const record = new MarsConfig({
		stack_path: 'infra/stacks',
	});

	assert.equal(record.work_path, WORK_PATH);
});

test('MarsConfig fails construction for invalid input', () => {
	assert.throws(() => new MarsConfig({ work_path: '.mars' }));
});

test('createDefaultMarsConfig returns the default config', () => {
	const record = createDefaultMarsConfig();

	assert.equal(record.stack_path, 'infra/stacks');
	assert.equal(record.work_path, '.mars');
});
