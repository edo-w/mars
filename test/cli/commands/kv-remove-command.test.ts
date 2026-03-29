import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { KvService } from '#src/app/kv/kv-service';
import { createKvRemoveCommand, handleKvRemoveCommand } from '#src/cli/commands/kv-remove-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createKvRemoveCommand builds the remove command', () => {
	const command = createKvRemoveCommand(new Tiny());

	assert.equal(command.name(), 'remove');
	assert.equal(command.alias(), 'rm');
});

test('handleKvRemoveCommand removes a kv value', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const remove = vi.fn(async () => true);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, remove }],
	]);

	await handleKvRemoveCommand({ env: null, key_path: '/service/value' }, container);

	assert.equal(remove.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createKvRemoveCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const remove = vi.fn(async () => true);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, remove }],
	]);
	const command = createKvRemoveCommand(container);

	await runCommand(command, ['/service/value']);

	assert.equal(remove.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
