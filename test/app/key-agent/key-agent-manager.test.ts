import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';
import { KeyAgentState } from '#src/app/state/state-shapes';

const { mockClose, mockForceKill, mockIsProcessAlive, mockPing, mockShutdown, mockSleep, mockSpawn, mockUnref } =
	vi.hoisted(() => {
		return {
			mockClose: vi.fn(async () => {}),
			mockForceKill: vi.fn(),
			mockIsProcessAlive: vi.fn(),
			mockPing: vi.fn(),
			mockShutdown: vi.fn(),
			mockSleep: vi.fn(async () => {}),
			mockSpawn: vi.fn(() => {
				return {
					unref: mockUnref,
				};
			}),
			mockUnref: vi.fn(),
		};
	});

vi.mock('#src/app/key-agent/key-agent-client', () => {
	return {
		KeyAgentClient: class {
			async close() {
				await mockClose();
			}

			async ping(request: unknown) {
				return mockPing(request);
			}

			async shutdown(request: unknown) {
				return mockShutdown(request);
			}
		},
	};
});

vi.mock('#src/lib/process', () => {
	return {
		forceKill: mockForceKill,
		isProcessAlive: mockIsProcessAlive,
	};
});

vi.mock('#src/lib/promise', () => {
	return {
		sleep: mockSleep,
	};
});

vi.mock('node:child_process', () => {
	return {
		default: {
			spawn: mockSpawn,
		},
	};
});

const { KeyAgentManager } = await import('#src/app/key-agent/key-agent-manager');

function createKeyAgentState() {
	return new KeyAgentState({
		pid: 123,
		socket: '/tmp/mars.sock',
		token: 'token',
	});
}

function sut() {
	const getKeyAgent = vi.fn();
	const clearKeyAgentIfMatches = vi.fn(async () => {});
	const stateService = {
		clearKeyAgentIfMatches,
		getKeyAgent,
	};
	const manager = new KeyAgentManager(stateService as never);

	return {
		clearKeyAgentIfMatches,
		getKeyAgent,
		manager,
	};
}

beforeEach(() => {
	mockClose.mockReset();
	mockForceKill.mockReset();
	mockIsProcessAlive.mockReset();
	mockPing.mockReset();
	mockShutdown.mockReset();
	mockSleep.mockReset();
	mockSpawn.mockReset();
	mockUnref.mockReset();
});

test('KeyAgentManager show returns stopped when there is no key-agent state', async () => {
	const { getKeyAgent, manager } = sut();

	getKeyAgent.mockResolvedValue(null);

	const result = await manager.show();

	assert.equal(result.kind, 'stopped');
});

test('KeyAgentManager ping returns ok when the client ping succeeds', async () => {
	const { getKeyAgent, manager } = sut();

	getKeyAgent.mockResolvedValue(createKeyAgentState());
	mockPing.mockResolvedValue({
		ok: true,
		type: 'ping',
	});

	const result = await manager.ping();

	assert.equal(result.kind, 'ok');
	assert.equal(mockClose.mock.calls.length, 1);
});

test('KeyAgentManager start returns running when the existing agent responds to ping', async () => {
	const { getKeyAgent, manager } = sut();

	getKeyAgent.mockResolvedValue(createKeyAgentState());
	mockIsProcessAlive.mockReturnValue(true);
	mockPing.mockResolvedValue({
		ok: true,
		type: 'ping',
	});

	const result = await manager.start();

	assert.equal(result.kind, 'running');
	assert.equal(mockSpawn.mock.calls.length, 0);
});

test('KeyAgentManager start spawns serve and returns timeout when the agent never becomes ready', async () => {
	const { getKeyAgent, manager } = sut();
	const originalArg = process.argv[1] ?? '';

	process.argv[1] = 'src/cli/main.ts';
	getKeyAgent.mockResolvedValue(null);

	try {
		const result = await manager.start();
		const spawnCall = mockSpawn.mock.calls[0] as unknown[] | undefined;
		const spawnArgs = spawnCall?.[1];

		assert.equal(result.kind, 'timeout');
		assert.equal(mockSpawn.mock.calls.length, 1);
		assert.deepEqual(spawnArgs, ['src/cli/main.ts', 'key-agent', 'serve']);
		assert.equal(mockUnref.mock.calls.length, 1);
	} finally {
		process.argv[1] = originalArg;
	}
});

test('KeyAgentManager stop returns not_running when the stored process is already dead', async () => {
	const { clearKeyAgentIfMatches, getKeyAgent, manager } = sut();
	const keyAgent = createKeyAgentState();

	getKeyAgent.mockResolvedValue(keyAgent);
	mockIsProcessAlive.mockReturnValue(false);

	const result = await manager.stop();

	assert.equal(result.kind, 'not_running');
	assert.deepEqual(clearKeyAgentIfMatches.mock.calls[0], [keyAgent.pid, keyAgent.token]);
});

test('KeyAgentManager stop force kills the process after shutdown timeout', async () => {
	const { clearKeyAgentIfMatches, getKeyAgent, manager } = sut();
	const keyAgent = createKeyAgentState();
	const originalDateNow = Date.now;
	let now = 0;

	getKeyAgent.mockResolvedValue(keyAgent);
	mockShutdown.mockResolvedValue({
		ok: true,
		type: 'shutdown',
	});
	mockIsProcessAlive.mockReturnValue(true);
	Date.now = () => {
		now += 1000;

		return now;
	};

	try {
		const result = await manager.stop();

		assert.equal(result.kind, 'stopped');
		assert.equal(mockForceKill.mock.calls.length, 1);
		assert.deepEqual(clearKeyAgentIfMatches.mock.calls[0], [keyAgent.pid, keyAgent.token]);
	} finally {
		Date.now = originalDateNow;
	}
});
