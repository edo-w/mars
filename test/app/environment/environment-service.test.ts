import assert from 'node:assert/strict';
import { test } from 'vitest';
import { stringify } from 'yaml';
import { ConfigService } from '#src/app/config/config-service';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { StateService } from '#src/app/state/state-service';
import { toJsonText } from '#test/helpers/json';
import { toMarsConfigText } from '#test/helpers/mars-config';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const configService = new ConfigService(vfs);
	const stateService = new StateService(vfs, configService);
	const service = new EnvironmentService(vfs, configService, stateService);

	return {
		service,
		vfs,
	};
}

test('EnvironmentService lists environments from envs_path', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText();
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '111111111111',
		aws_region: 'us-east-1',
	});
	const testEnvironment = stringify({
		name: 'test',
		namespace: 'gl',
		aws_account_id: '111111111111',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);
	vfs.setTextFile('infra/envs/test/environment.yml', testEnvironment);

	const environments = await service.list();
	const environmentIds = environments.map((environment) => environment.id);

	assert.deepEqual(environmentIds, ['gl-dev', 'gl-test']);
});

test('EnvironmentService marks the selected environment during list', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText();
	const stateFile = toJsonText({
		key_agent: null,
		selected_environment: 'infra/envs/dev/environment.yml',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '111111111111',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('.mars/state.json', stateFile);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const environments = await service.list();
	const selectedEnvironment = environments[0];

	assert.equal(selectedEnvironment?.selected, true);
});

test('EnvironmentService returns the selected environment', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText();
	const stateFile = toJsonText({
		key_agent: null,
		selected_environment: 'infra/envs/dev/environment.yml',
	});
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '111111111111',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('.mars/state.json', stateFile);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const environment = await service.getCurrent();

	assert.equal(environment?.id, 'gl-dev');
});

test('EnvironmentService creates a new environment from config namespace', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		namespace: 'app',
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	const environment = await service.create('dev');
	const environmentFile = vfs.files.get('/repo/infra/envs/dev/environment.yml');
	const expectedEnvironmentFile = stringify({
		namespace: 'app',
		name: 'dev',
		aws_account_id: 'TODO',
		aws_region: 'TODO',
	});

	assert.equal(environment?.id, 'app-dev');
	assert.equal(environmentFile, expectedEnvironmentFile);
});

test('EnvironmentService does not create an environment that already exists', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText({
		namespace: 'app',
	});
	const environmentFile = stringify({
		name: 'dev',
		namespace: 'app',
		aws_account_id: 'TODO',
		aws_region: 'TODO',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', environmentFile);

	const environment = await service.create('dev');

	assert.equal(environment, null);
});

test('EnvironmentService selects an environment by id', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText();
	const devEnvironment = stringify({
		name: 'dev',
		namespace: 'gl',
		aws_account_id: '111111111111',
		aws_region: 'us-east-1',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.setTextFile('infra/envs/dev/environment.yml', devEnvironment);

	const environment = await service.select('gl-dev');
	const stateFile = vfs.files.get('/repo/.mars/state.json');
	const expectedStateFile = toJsonText({
		key_agent: null,
		selected_environment: 'infra/envs/dev/environment.yml',
	});

	assert.equal(environment?.selected, true);
	assert.equal(stateFile, expectedStateFile);
});

test('EnvironmentService returns null when selecting a missing environment', async () => {
	const { service, vfs } = sut();
	const marsConfig = toMarsConfigText();

	vfs.setTextFile('mars.config.json', marsConfig);

	const environment = await service.select('gl-dev');

	assert.equal(environment, null);
});
