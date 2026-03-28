import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KvService } from '#src/cli/app/kv/kv-service';
import { createKvStateClearCommand, handleKvStateClearCommand } from '#src/cli/commands/kv-state-clear-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';

test('createKvStateClearCommand builds the clear command', () => {
	const command = createKvStateClearCommand(new Tiny());

	assert.equal(command.name(), 'clear');
});

test('handleKvStateClearCommand clears the kv state', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const stateClear = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, stateClear }],
	]);

	await handleKvStateClearCommand({ env: null }, container);

	assert.equal(stateClear.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createKvStateClearCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const stateClear = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, stateClear }],
	]);
	const command = createKvStateClearCommand(container);

	await runCommand(command, []);

	assert.equal(stateClear.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
