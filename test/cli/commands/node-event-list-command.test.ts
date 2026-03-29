import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { NodeEventAction } from '#src/app/node/node-models';
import { NodeService } from '#src/app/node/node-service';
import { createNodeEventListCommand, handleNodeEventListCommand } from '#src/cli/commands/node-event-list-command';
import { runCommand } from '#test/helpers/command';
import { createCommandContainer } from '#test/helpers/command-container';
import { createEnvironment } from '#test/helpers/environment';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createNodeEventListCommand builds the list command', () => {
	const command = createNodeEventListCommand(new Tiny());

	assert.equal(command.name(), 'list');
});

test('handleNodeEventListCommand lists node events through the node service', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const listEvents = vi.fn(async () => [
		{
			action: NodeEventAction.SetStatus,
			context: {
				new: 'ready',
				prev: 'new',
			},
			date: '2026-03-28T23:11:40.592Z',
			node_id: 'ip-1-2-3-4',
		},
	]);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, listEvents }],
	]);

	await handleNodeEventListCommand(
		{
			env: null,
			id: '1.2.3.4',
		},
		container,
	);

	const listEventsCall = listEvents.mock.calls[0] as unknown[] | undefined;

	if (listEventsCall === undefined) {
		throw new Error('expected node event list call');
	}

	assert.equal(listEvents.mock.calls.length, 1);
	assert.equal(listEventsCall[1], 'ip-1-2-3-4');
	assert.equal(close.mock.calls.length, 1);
	const infoMessages = logger.info.mock.calls.map(([message]) => message);

	assert.equal(infoMessages[0]?.trim(), 'id          action      date                      context');
	assert.equal(infoMessages[1], 'ip-1-2-3-4  set-status  2026-03-28T23:11:40.592Z  new=ready; prev=new');
});

test('createNodeEventListCommand normalizes commander values', async () => {
	const environment = createEnvironment();
	const close = vi.fn(async () => {});
	const listEvents = vi.fn(async () => []);
	const container = createCommandContainer([
		[EnvironmentService, { resolveEnvironment: vi.fn(async () => environment) }],
		[NodeService, { close, listEvents }],
	]);
	const command = createNodeEventListCommand(container);

	await runCommand(command, ['ip-1-2-3-4']);

	const listEventsCall = listEvents.mock.calls[0] as unknown[] | undefined;

	if (listEventsCall === undefined) {
		throw new Error('expected node event list call');
	}

	assert.equal(listEvents.mock.calls.length, 1);
	assert.equal(listEventsCall[1], 'ip-1-2-3-4');
	assert.equal(close.mock.calls.length, 1);
});
