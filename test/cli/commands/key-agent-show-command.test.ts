import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { KeyAgentManager } from '#src/cli/app/key-agent/key-agent-manager';
import { createKeyAgentShowCommand, handleKeyAgentShowCommand } from '#src/cli/commands/key-agent-show-command';
import { runCommand } from '#test/helpers/command';
import { createCommandScope } from '#test/helpers/command-container';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createKeyAgentShowCommand builds the show command', () => {
	const command = createKeyAgentShowCommand(new Tiny());

	assert.equal(command.name(), 'show');
	assert.equal(command.description(), 'Show the current key-agent status.');
});

test('handleKeyAgentShowCommand logs the stopped state', async () => {
	const show = vi.fn(async () => {
		return {
			kind: 'stopped' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		show,
	});

	await handleKeyAgentShowCommand(container);

	assert.deepEqual(logger.info.mock.calls[0], ['key-agent not running']);
});

test('handleKeyAgentShowCommand logs the running state', async () => {
	const show = vi.fn(async () => {
		return {
			key_agent: {
				pid: 123,
				socket: '/tmp/mars.sock',
			},
			kind: 'running' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		show,
	});

	await handleKeyAgentShowCommand(container);

	assert.deepEqual(logger.info.mock.calls[0], ['pid: 123']);
	assert.deepEqual(logger.info.mock.calls[1], ['socket: /tmp/mars.sock']);
});

test('createKeyAgentShowCommand runs through commander', async () => {
	const show = vi.fn(async () => {
		return {
			kind: 'stopped' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		show,
	});
	const command = createKeyAgentShowCommand(container);

	await runCommand(command, []);

	assert.equal(show.mock.calls.length, 1);
});
