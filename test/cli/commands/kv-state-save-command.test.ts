import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KvService } from '#src/cli/app/kv/kv-service';
import { createKvStateSaveCommand, handleKvStateSaveCommand } from '#src/cli/commands/kv-state-save-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';

test('createKvStateSaveCommand builds the save command', () => {
	const command = createKvStateSaveCommand(new Tiny());

	assert.equal(command.name(), 'save');
});

test('handleKvStateSaveCommand saves the kv state', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const stateSave = vi.fn(async () => {
		return {
			deleted_blob_count: 0,
			uploaded_blob_count: 0,
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, stateSave }],
	]);

	await handleKvStateSaveCommand({ env: null }, container);

	assert.equal(stateSave.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createKvStateSaveCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const stateSave = vi.fn(async () => {
		return {
			deleted_blob_count: 0,
			uploaded_blob_count: 0,
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, stateSave }],
	]);
	const command = createKvStateSaveCommand(container);

	await runCommand(command, []);

	assert.equal(stateSave.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
