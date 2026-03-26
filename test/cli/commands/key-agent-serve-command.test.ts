import assert from 'node:assert/strict';
import { Tiny } from '@edo-w/tiny';
import { test, vi } from 'vitest';
import { ConfigService } from '#src/cli/app/config/config-service';
import { KeyAgentManager } from '#src/cli/app/key-agent/key-agent-manager';
import { KeyAgentServer } from '#src/cli/app/key-agent/key-agent-server';
import { configureKeyAgentLogging } from '#src/cli/boot/logging';
import { createKeyAgentServeCommand, handleKeyAgentServeCommand } from '#src/cli/commands/key-agent-serve-command';
import { Vfs } from '#src/lib/vfs';
import { runCommand } from '#test/helpers/command';

vi.mock('#src/cli/boot/logging', async () => {
	const actual = await vi.importActual<typeof import('#src/cli/boot/logging')>('#src/cli/boot/logging');

	return {
		...actual,
		configureKeyAgentLogging: vi.fn(async () => {}),
	};
});

test('handleKeyAgentServeCommand configures logging and starts the server', async () => {
	const get = vi.fn(async () => {
		return {
			work_path: '.mars',
		};
	});
	const ensureDirectory = vi.fn(async () => {});
	const resolve = vi.fn(() => {
		return '/repo/.mars/key-agent.log';
	});
	const show = vi.fn(async () => {
		return {
			kind: 'stopped' as const,
		};
	});
	const serveAndWaitForClose = vi.fn(async () => {});
	const container = new Tiny();
	const mockExit = vi.fn();
	const originalExit = process.exit;

	process.exit = mockExit as never;
	container.addFactory(ConfigService as never, () => {
		return {
			get,
		};
	});
	container.addFactory(Vfs as never, () => {
		return {
			ensureDirectory,
			resolve,
		};
	});
	container.addFactory(KeyAgentManager as never, () => {
		return {
			show,
		};
	});
	container.addFactory(KeyAgentServer as never, () => {
		return {
			serveAndWaitForClose,
		};
	});

	try {
		await handleKeyAgentServeCommand(container);
	} finally {
		process.exit = originalExit;
	}

	assert.equal(ensureDirectory.mock.calls.length, 1);
	assert.equal(resolve.mock.calls.length, 1);
	assert.equal(vi.mocked(configureKeyAgentLogging).mock.calls.length, 1);
	assert.equal(serveAndWaitForClose.mock.calls.length, 1);
	assert.deepEqual(mockExit.mock.calls[0], [0]);
});

test('createKeyAgentServeCommand runs through commander', async () => {
	const get = vi.fn(async () => {
		return {
			work_path: '.mars',
		};
	});
	const ensureDirectory = vi.fn(async () => {});
	const resolve = vi.fn(() => {
		return '/repo/.mars/key-agent.log';
	});
	const show = vi.fn(async () => {
		return {
			key_agent: {
				pid: 123,
				socket: '/tmp/mars.sock',
				token: 'token',
			},
			kind: 'running' as const,
		};
	});
	const serveAndWaitForClose = vi.fn(async () => {});
	const container = new Tiny();

	container.addFactory(ConfigService as never, () => {
		return { get };
	});
	container.addFactory(Vfs as never, () => {
		return { ensureDirectory, resolve };
	});
	container.addFactory(KeyAgentManager as never, () => {
		return { show };
	});
	container.addFactory(KeyAgentServer as never, () => {
		return { serveAndWaitForClose };
	});

	await runCommand(createKeyAgentServeCommand(container), []);

	assert.equal(show.mock.calls.length, 1);
	assert.equal(serveAndWaitForClose.mock.calls.length, 0);
});
