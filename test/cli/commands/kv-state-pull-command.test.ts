import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KvService } from '#src/cli/app/kv/kv-service';
import { createKvStatePullCommand, handleKvStatePullCommand } from '#src/cli/commands/kv-state-pull-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';

test('createKvStatePullCommand builds the pull command', () => {
	const command = createKvStatePullCommand(new Tiny());

	assert.equal(command.name(), 'pull');
});

test('handleKvStatePullCommand pulls the kv state', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const statePull = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, statePull }],
	]);

	await handleKvStatePullCommand({ env: null }, container);

	assert.equal(statePull.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createKvStatePullCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const statePull = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, statePull }],
	]);
	const command = createKvStatePullCommand(container);

	await runCommand(command, []);

	assert.equal(statePull.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
