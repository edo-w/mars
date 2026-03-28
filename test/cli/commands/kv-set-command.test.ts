import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KvService } from '#src/cli/app/kv/kv-service';
import { createKvSetCommand, handleKvSetCommand } from '#src/cli/commands/kv-set-command';
import { Vfs } from '#src/lib/vfs';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';
import { MockVfs } from '#test/mocks/mock-vfs';

useMockVLogger();

test('createKvSetCommand builds the set command', () => {
	const command = createKvSetCommand(new Tiny());

	assert.equal(command.name(), 'set');
});

test('handleKvSetCommand stores the value through the kv service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const set = vi.fn(async (..._args: unknown[]) => {
		return {
			key_path: '/service/value',
			secret: false,
			type: 'text' as const,
			version_id: 0,
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, set }],
		[Vfs, new MockVfs() as Vfs],
	]);

	await handleKvSetCommand(
		{
			env: null,
			file_path: null,
			input: false,
			key_path: '/service/value',
			secret: false,
			value: 'hello',
		},
		container,
	);

	const setCall = set.mock.calls[0];

	if (setCall === undefined) {
		throw new Error('expected kv set call');
	}

	const setEnvironment = setCall[0] as unknown;
	const setInput = setCall[1] as unknown as {
		data: Uint8Array;
	};

	assert.equal(setEnvironment, environment);
	assert.equal(new TextDecoder().decode(setInput.data), 'hello');
	assert.equal(close.mock.calls.length, 1);
});

test('createKvSetCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const set = vi.fn(async (..._args: unknown[]) => {
		return {
			key_path: '/service/value',
			secret: false,
			type: 'text' as const,
			version_id: 0,
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, set }],
		[Vfs, new MockVfs() as Vfs],
	]);
	const command = createKvSetCommand(container);

	await runCommand(command, ['/service/value', '--value', 'hello']);

	assert.equal(set.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
