import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { PlaybookService } from '#src/app/playbook/playbook-service';
import { createPlaybookRunCommand, handlePlaybookRunCommand } from '#src/cli/commands/playbook-run-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

useMockVLogger();

test('createPlaybookRunCommand builds the playbook run command', () => {
	const command = createPlaybookRunCommand(new Tiny());

	assert.equal(command.name(), 'run');
});

test('handlePlaybookRunCommand runs a playbook through the playbook service', async () => {
	const environment = createEnvironment();
	const onEvent = vi.fn(() => {
		return () => {};
	});
	const result = vi.fn(async () => {
		return {
			change_node_ids: [],
			duration: 10,
			end_date: '2026-03-28T00:00:10.000Z',
			fail_node_ids: [],
			node_ids: ['ip-1-1-1-1'],
			ok_node_ids: ['ip-1-1-1-1'],
			playbook_name: 'bootstrap',
			skip_node_ids: [],
			start_date: '2026-03-28T00:00:00.000Z',
			task_results: [],
		};
	});
	const run = vi.fn(async () => {
		return {
			onEvent,
			result,
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[PlaybookService, { run }],
	]);

	await handlePlaybookRunCommand(
		{
			env: null,
			file: 'playbooks/bootstrap.ts',
		},
		container,
	);

	assert.equal(run.mock.calls.length, 1);
	assert.equal(onEvent.mock.calls.length, 1);
	assert.equal(result.mock.calls.length, 1);
});

test('createPlaybookRunCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const run = vi.fn(async () => {
		return {
			onEvent: () => {
				return () => {};
			},
			result: async () => {
				return {
					change_node_ids: [],
					duration: 0,
					end_date: '2026-03-28T00:00:00.000Z',
					fail_node_ids: [],
					node_ids: [],
					ok_node_ids: [],
					playbook_name: 'bootstrap',
					skip_node_ids: [],
					start_date: '2026-03-28T00:00:00.000Z',
					task_results: [],
				};
			},
		};
	});
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[PlaybookService, { run }],
	]);
	const command = createPlaybookRunCommand(container);

	await runCommand(command, ['playbooks/bootstrap.ts']);

	assert.equal(run.mock.calls.length, 1);
	const call = run.mock.calls[0] as unknown[] | undefined;

	assert.equal(call?.[1], 'playbooks/bootstrap.ts');
});
