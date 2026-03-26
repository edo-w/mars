import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createDefaultMarsState, KeyAgentState, MarsState } from '#src/cli/app/state/state-shapes';

test('MarsState constructs from valid input', () => {
	const state = new MarsState({
		key_agent: {
			pid: 123,
			socket: '/tmp/mars.sock',
			token: 'token',
		},
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	assert.equal(state.key_agent?.pid, 123);
	assert.equal(state.selected_environment, 'infra/envs/dev/environment.yml');
});

test('MarsState fails construction for invalid input', () => {
	assert.throws(() => {
		new MarsState({});
	});
});

test('createDefaultMarsState returns the default state', () => {
	const state = createDefaultMarsState();

	assert.equal(state.key_agent, null);
	assert.equal(state.selected_environment, null);
});

test('KeyAgentState constructs from valid input', () => {
	const keyAgentState = new KeyAgentState({
		pid: 123,
		socket: '/tmp/mars.sock',
		token: 'token',
	});

	assert.equal(keyAgentState.pid, 123);
});
