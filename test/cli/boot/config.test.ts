import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createDefaultMarsConfig, ENVS_PATH, MarsConfig, NAMESPACE, WORK_PATH } from '#src/cli/boot/config';

test('MarsConfig constructs from valid input', () => {
	const config = new MarsConfig({
		namespace: 'gl',
		envs_path: 'infra/envs',
		work_path: '.mars',
	});

	assert.equal(config.namespace, 'gl');
	assert.equal(config.envs_path, 'infra/envs');
	assert.equal(config.work_path, '.mars');
});

test('MarsConfig defaults work_path when omitted', () => {
	const config = new MarsConfig({
		namespace: 'gl',
		envs_path: 'infra/envs',
	});

	assert.equal(config.work_path, WORK_PATH);
});

test('MarsConfig fails construction for invalid input', () => {
	assert.throws(() => {
		new MarsConfig({
			envs_path: 'infra/envs',
			work_path: '.mars',
		});
	});
});

test('createDefaultMarsConfig returns the default config', () => {
	const config = createDefaultMarsConfig();

	assert.equal(config.namespace, NAMESPACE);
	assert.equal(config.envs_path, ENVS_PATH);
	assert.equal(config.work_path, WORK_PATH);
});
