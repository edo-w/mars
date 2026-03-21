import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createDefaultMarsState, MarsState } from '#src/cli/app/state/state-shapes';

test('MarsState constructs from valid input', () => {
	const state = new MarsState({
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	assert.equal(state.selected_environment, 'infra/envs/dev/environment.yml');
});

test('MarsState fails construction for invalid input', () => {
	assert.throws(() => {
		new MarsState({});
	});
});

test('createDefaultMarsState returns the default state', () => {
	const state = createDefaultMarsState();

	assert.equal(state.selected_environment, null);
});
