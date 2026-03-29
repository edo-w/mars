import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import { createKeyAgentStartCommand, handleKeyAgentStartCommand } from '#src/cli/commands/key-agent-start-command';
import { runCommand } from '#test/helpers/command';
import { createCommandScope } from '#test/helpers/command-container';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createKeyAgentStartCommand builds the start command', () => {
	const command = createKeyAgentStartCommand(new Tiny());

	assert.equal(command.name(), 'start');
	assert.equal(command.description(), 'Start the Mars key-agent.');
});

test('handleKeyAgentStartCommand logs timeout errors', async () => {
	const start = vi.fn(async () => {
		return {
			kind: 'timeout' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		start,
	});

	await handleKeyAgentStartCommand(container);

	assert.deepEqual(logger.error.mock.calls[0], ['failed to start key-agent. ping timeout']);
});

test('handleKeyAgentStartCommand logs when the agent is already running', async () => {
	const start = vi.fn(async () => {
		return {
			key_agent: {
				pid: 123,
			},
			kind: 'running' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		start,
	});

	await handleKeyAgentStartCommand(container);

	assert.deepEqual(logger.info.mock.calls[0], ['key-agent running with 123']);
});

test('handleKeyAgentStartCommand logs when the agent starts', async () => {
	const start = vi.fn(async () => {
		return {
			key_agent: {
				pid: 456,
			},
			kind: 'started' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		start,
	});

	await handleKeyAgentStartCommand(container);

	assert.deepEqual(logger.info.mock.calls[0], ['key-agent started with 456']);
});

test('createKeyAgentStartCommand runs through commander', async () => {
	const start = vi.fn(async () => {
		return {
			kind: 'timeout' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		start,
	});
	const command = createKeyAgentStartCommand(container);

	await runCommand(command, []);

	assert.equal(start.mock.calls.length, 1);
});
