import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { KvService } from '#src/cli/app/kv/kv-service';
import { createKvGetCommand, handleKvGetCommand } from '#src/cli/commands/kv-get-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createKvGetCommand builds the get command', () => {
	const command = createKvGetCommand(new Tiny());

	assert.equal(command.name(), 'get');
});

test('handleKvGetCommand writes raw value bytes to stdout', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const originalWrite = process.stdout.write;
	const write = vi.fn(() => true);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[
			KvService,
			{
				get: vi.fn(async () => {
					return {
						data: new TextEncoder().encode('hello'),
						key_path: '/service/value',
						secret: false,
						type: 'text' as const,
						version_id: 0,
					};
				}),
				close,
			},
		],
	]);

	try {
		process.stdout.write = write as never;

		await handleKvGetCommand(
			{
				env: null,
				key_path: '/service/value',
				raw: true,
			},
			container,
		);
	} finally {
		process.stdout.write = originalWrite;
	}

	assert.equal(write.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});

test('createKvGetCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const get = vi.fn(async () => {
		return {
			data: new TextEncoder().encode('hello'),
			key_path: '/service/value',
			secret: false,
			type: 'text' as const,
			version_id: 0,
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, get }],
	]);
	const command = createKvGetCommand(container);
	const originalWrite = process.stdout.write;
	const write = vi.fn(() => true);

	try {
		process.stdout.write = write as never;

		await runCommand(command, ['/service/value', '--raw']);
	} finally {
		process.stdout.write = originalWrite;
	}

	assert.equal(get.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
