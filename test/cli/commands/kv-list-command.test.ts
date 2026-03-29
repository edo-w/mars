import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { KvService } from '#src/app/kv/kv-service';
import { createKvListCommand, handleKvListCommand } from '#src/cli/commands/kv-list-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createKvListCommand builds the list command', () => {
	const command = createKvListCommand(new Tiny());

	assert.equal(command.name(), 'list');
});

test('handleKvListCommand logs kv list rows', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[
			KvService,
			{
				list: vi.fn(async () => {
					return [
						{
							date: '2026-03-26T00:00:00.000Z',
							key: '/service/value',
							secret: false,
							size: 5,
							type: 'text' as const,
						},
					];
				}),
				close,
			},
		],
	]);

	await handleKvListCommand({ env: null, key_path: '/service' }, container);

	assert.equal(logger.info.mock.calls.length > 0, true);
	assert.equal(close.mock.calls.length, 1);
});

test('createKvListCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const list = vi.fn(async () => []);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, list }],
	]);
	const command = createKvListCommand(container);

	await runCommand(command, []);

	assert.deepEqual(list.mock.calls[0], [environment, '/']);
	assert.equal(close.mock.calls.length, 1);
});
