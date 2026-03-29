import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { KvService } from '#src/app/kv/kv-service';
import { createKvShowCommand, handleKvShowCommand } from '#src/cli/commands/kv-show-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createKvShowCommand builds the show command', () => {
	const command = createKvShowCommand(new Tiny());

	assert.equal(command.name(), 'show');
});

test('handleKvShowCommand logs kv metadata', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[
			KvService,
			{
				close,
				show: vi.fn(async () => {
					return {
						create_date: '2026-03-26T00:00:00.000Z',
						key_path: '/service/value',
						secret: false,
						size: 5,
						type: 'text' as const,
						update_date: '2026-03-26T00:00:00.000Z',
						version_id: 0,
					};
				}),
			},
		],
	]);

	await handleKvShowCommand({ env: null, key_path: '/service/value' }, container);

	assert.equal(
		logger.info.mock.calls.some((call) => call[0] === 'key: /service/value'),
		true,
	);
	assert.equal(close.mock.calls.length, 1);
});

test('createKvShowCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const show = vi.fn(async () => {
		return {
			create_date: '2026-03-26T00:00:00.000Z',
			key_path: '/service/value',
			secret: false,
			size: 5,
			type: 'text' as const,
			update_date: '2026-03-26T00:00:00.000Z',
			version_id: 0,
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[KvService, { close, show }],
	]);
	const command = createKvShowCommand(container);

	await runCommand(command, ['/service/value']);

	assert.equal(show.mock.calls.length, 1);
	assert.equal(close.mock.calls.length, 1);
});
