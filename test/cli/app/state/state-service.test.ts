import assert from 'node:assert/strict';
import { test } from 'vitest';
import { StateService } from '#src/cli/app/state/state-service';
import { toJsonText } from '#test/helpers/json';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const service = new StateService(vfs);

	return {
		service,
		vfs,
	};
}

test('StateService returns null when state is missing', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		work_path: '.mars',
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const selectedEnvironmentPath = await service.getSelectedEnvironmentPath();

	assert.equal(selectedEnvironmentPath, null);
});

test('StateService writes the selected environment into state.json', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		work_path: '.mars',
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	await service.setSelectedEnvironmentPath('infra/envs/dev/environment.yml');

	const stateFile = vfs.files.get('/repo/.mars/state.json');
	const expectedStateFile = toJsonText({
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	assert.equal(stateFile, expectedStateFile);
});

test('StateService reads the selected environment from state.json', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		work_path: '.mars',
	});
	const stateFile = toJsonText({
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('.mars/state.json', stateFile);

	const selectedEnvironmentPath = await service.getSelectedEnvironmentPath();

	assert.equal(selectedEnvironmentPath, 'infra/envs/dev/environment.yml');
});
