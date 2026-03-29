import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import { createKeyAgentStopCommand, handleKeyAgentStopCommand } from '#src/cli/commands/key-agent-stop-command';
import { runCommand } from '#test/helpers/command';
import { createCommandScope } from '#test/helpers/command-container';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createKeyAgentStopCommand builds the stop command', () => {
	const command = createKeyAgentStopCommand(new Tiny());

	assert.equal(command.name(), 'stop');
	assert.equal(command.description(), 'Stop the Mars key-agent.');
});

test('handleKeyAgentStopCommand logs the not running state', async () => {
	const stop = vi.fn(async () => {
		return {
			kind: 'not_running' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		stop,
	});

	await handleKeyAgentStopCommand(container);

	assert.deepEqual(logger.info.mock.calls[0], ['key-agent not running']);
});

test('handleKeyAgentStopCommand logs the stopped pid', async () => {
	const stop = vi.fn(async () => {
		return {
			key_agent: {
				pid: 123,
			},
			kind: 'stopped' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		stop,
	});

	await handleKeyAgentStopCommand(container);

	assert.deepEqual(logger.info.mock.calls[0], ['stopping key-agent 123']);
});

test('createKeyAgentStopCommand runs through commander', async () => {
	const stop = vi.fn(async () => {
		return {
			kind: 'not_running' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		stop,
	});
	const command = createKeyAgentStopCommand(container);

	await runCommand(command, []);

	assert.equal(stop.mock.calls.length, 1);
});
