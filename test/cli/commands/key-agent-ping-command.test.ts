import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import { createKeyAgentPingCommand, handleKeyAgentPingCommand } from '#src/cli/commands/key-agent-ping-command';
import { runCommand } from '#test/helpers/command';
import { createCommandScope } from '#test/helpers/command-container';
import { useMockVLogger } from '#test/helpers/vlogger';

const logger = useMockVLogger();

test('createKeyAgentPingCommand builds the ping command', () => {
	const command = createKeyAgentPingCommand(new Tiny());

	assert.equal(command.name(), 'ping');
	assert.equal(command.description(), 'Ping the current Mars key-agent.');
});

test('handleKeyAgentPingCommand logs the not running message', async () => {
	const ping = vi.fn(async () => {
		return {
			kind: 'not_running' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		ping,
	});

	await handleKeyAgentPingCommand(container);

	assert.deepEqual(logger.info.mock.calls[0], ['key-agent is not running']);
});

test('handleKeyAgentPingCommand logs the ping failure', async () => {
	const ping = vi.fn(async () => {
		return {
			error: 'boom',
			kind: 'failed' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		ping,
	});

	await handleKeyAgentPingCommand(container);

	assert.deepEqual(logger.error.mock.calls[0], ['ping failed: boom']);
});

test('handleKeyAgentPingCommand logs the ping success', async () => {
	const ping = vi.fn(async () => {
		return {
			kind: 'ok' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		ping,
	});

	await handleKeyAgentPingCommand(container);

	assert.deepEqual(logger.info.mock.calls[0], ['ping sucessfully']);
});

test('createKeyAgentPingCommand runs through commander', async () => {
	const ping = vi.fn(async () => {
		return {
			kind: 'ok' as const,
		};
	});
	const container = createCommandScope(KeyAgentManager, {
		ping,
	});
	const command = createKeyAgentPingCommand(container);

	await runCommand(command, []);

	assert.equal(ping.mock.calls.length, 1);
});
