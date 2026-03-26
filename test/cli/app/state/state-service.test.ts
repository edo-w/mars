import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ConfigService } from '#src/cli/app/config/config-service';
import { StateService } from '#src/cli/app/state/state-service';
import { KeyAgentState } from '#src/cli/app/state/state-shapes';
import { toJsonText } from '#test/helpers/json';
import { toMarsConfigText } from '#test/helpers/mars-config';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const configService = new ConfigService(vfs);
	const service = new StateService(vfs, configService);

	return {
		service,
		vfs,
	};
}

test('StateService returns null when state is missing', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const selectedEnvironmentPath = await service.getSelectedEnvironmentPath();

	assert.equal(selectedEnvironmentPath, null);
});

test('StateService writes the selected environment into state.json', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	await service.setSelectedEnvironmentPath('infra/envs/dev/environment.yml');

	const stateFile = vfs.files.get('/repo/.mars/state.json');
	const expectedStateFile = toJsonText({
		key_agent: null,
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	assert.equal(stateFile, expectedStateFile);
});

test('StateService reads the selected environment from state.json', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
	});
	const stateFile = toJsonText({
		key_agent: null,
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('.mars/state.json', stateFile);

	const selectedEnvironmentPath = await service.getSelectedEnvironmentPath();

	assert.equal(selectedEnvironmentPath, 'infra/envs/dev/environment.yml');
});

test('StateService merges selected environment updates with key-agent state', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
	});
	const stateFile = toJsonText({
		key_agent: {
			pid: 123,
			socket: '/tmp/mars.sock',
			token: 'token',
		},
		selected_environment: null,
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('.mars/state.json', stateFile);

	await service.setSelectedEnvironmentPath('infra/envs/dev/environment.yml');

	const nextStateFile = vfs.files.get('/repo/.mars/state.json');
	const expectedStateFile = toJsonText({
		key_agent: {
			pid: 123,
			socket: '/tmp/mars.sock',
			token: 'token',
		},
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	assert.equal(nextStateFile, expectedStateFile);
});

test('StateService merges key-agent updates with selected environment state', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		backend: {
			local: {},
		},
	});
	const stateFile = toJsonText({
		key_agent: null,
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('.mars/state.json', stateFile);

	await service.setKeyAgent(
		new KeyAgentState({
			pid: 123,
			socket: '/tmp/mars.sock',
			token: 'token',
		}),
	);

	const nextStateFile = vfs.files.get('/repo/.mars/state.json');
	const expectedStateFile = toJsonText({
		key_agent: {
			pid: 123,
			socket: '/tmp/mars.sock',
			token: 'token',
		},
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	assert.equal(nextStateFile, expectedStateFile);
});
