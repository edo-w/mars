import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';
import type { KeyAgentClientFactory } from '#src/app/key-agent/key-agent-client-factory';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import { KeyAgentState } from '#src/app/state/state-shapes';
import { MockVProcess } from '#test/mocks/mock-vprocess';
import { MockVTimer } from '#test/mocks/mock-vtimer';

class MockKeyAgentClient {
	close = vi.fn(async () => {});
	ping = vi.fn();
	shutdown = vi.fn();
	clearAskpass = vi.fn();
	getAskpass = vi.fn();
	setAskpass = vi.fn();
}

class MockKeyAgentClientFactory {
	client: MockKeyAgentClient;
	create = vi.fn((_socketPath: string) => this.client);

	constructor(client: MockKeyAgentClient) {
		this.client = client;
	}
}

function createKeyAgentState() {
	return new KeyAgentState({
		pid: 123,
		socket: '/tmp/mars.sock',
		token: 'token',
	});
}

function sut() {
	const client = new MockKeyAgentClient();
	const clearKeyAgentIfMatches = vi.fn(async () => {});
	const getKeyAgent = vi.fn();
	const vprocess = new MockVProcess();
	const vtimer = new MockVTimer();
	const clientFactory = new MockKeyAgentClientFactory(client);
	const stateService = {
		clearKeyAgentIfMatches,
		getKeyAgent,
	};
	const manager = new KeyAgentManager(
		stateService as never,
		vprocess as never,
		clientFactory as unknown as KeyAgentClientFactory,
		vtimer as never,
	);

	return {
		clearKeyAgentIfMatches,
		client,
		clientFactory,
		getKeyAgent,
		manager,
		vprocess,
		vtimer,
	};
}

beforeEach(() => {
	vi.restoreAllMocks();
});

test('KeyAgentManager show returns stopped when there is no key-agent state', async () => {
	const { getKeyAgent, manager } = sut();

	getKeyAgent.mockResolvedValue(null);

	const result = await manager.show();

	assert.equal(result.kind, 'stopped');
});

test('KeyAgentManager ping returns ok when the client ping succeeds', async () => {
	const { client, getKeyAgent, manager } = sut();

	getKeyAgent.mockResolvedValue(createKeyAgentState());
	client.ping.mockResolvedValue({
		ok: true,
		type: 'ping',
	});

	const result = await manager.ping();

	assert.equal(result.kind, 'ok');
	assert.equal(client.close.mock.calls.length, 1);
});

test('KeyAgentManager start returns running when the existing agent responds to ping', async () => {
	const { client, getKeyAgent, manager, vprocess } = sut();

	getKeyAgent.mockResolvedValue(createKeyAgentState());
	vprocess.isProcessAlive = vi.fn(() => true);
	client.ping.mockResolvedValue({
		ok: true,
		type: 'ping',
	});

	const result = await manager.start();

	assert.equal(result.kind, 'running');
	assert.equal(vprocess.killCalls.length, 0);
});

test('KeyAgentManager start spawns serve and returns timeout when the agent never becomes ready', async () => {
	const { getKeyAgent, manager, vprocess, vtimer } = sut();

	vprocess.currentArgv = ['bun', 'src/cli/main.ts'];
	getKeyAgent.mockResolvedValue(null);

	const result = await manager.start();
	const spawnCall = vprocess.spawnCalls[0];

	assert.equal(result.kind, 'timeout');
	assert.deepEqual(spawnCall, {
		args: ['src/cli/main.ts', 'key-agent', 'serve'],
		command: 'bun',
		cwd: '/repo',
	});
	assert.equal(vtimer.sleepCalls.length > 0, true);
});

test('KeyAgentManager stop returns not_running when the stored process is already dead', async () => {
	const { clearKeyAgentIfMatches, getKeyAgent, manager, vprocess } = sut();
	const keyAgent = createKeyAgentState();

	getKeyAgent.mockResolvedValue(keyAgent);
	vprocess.isProcessAlive = vi.fn(() => false);

	const result = await manager.stop();

	assert.equal(result.kind, 'not_running');
	assert.deepEqual(clearKeyAgentIfMatches.mock.calls[0], [keyAgent.pid, keyAgent.token]);
});

test('KeyAgentManager stop force kills the process after shutdown timeout', async () => {
	const { clearKeyAgentIfMatches, client, getKeyAgent, manager, vprocess, vtimer } = sut();
	const keyAgent = createKeyAgentState();
	const originalDateNow = Date.now;
	let now = 0;

	getKeyAgent.mockResolvedValue(keyAgent);
	client.shutdown.mockResolvedValue({
		ok: true,
		type: 'shutdown',
	});
	vprocess.isProcessAlive = vi.fn(() => true);
	Date.now = () => {
		now += 1000;

		return now;
	};

	try {
		const result = await manager.stop();

		assert.equal(result.kind, 'stopped');
		assert.deepEqual(vprocess.killCalls[0], [keyAgent.pid, 'SIGKILL']);
		assert.deepEqual(clearKeyAgentIfMatches.mock.calls[0], [keyAgent.pid, keyAgent.token]);
		assert.equal(vtimer.sleepCalls.length > 0, true);
	} finally {
		Date.now = originalDateNow;
	}
});
