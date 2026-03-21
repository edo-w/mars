import assert from 'node:assert/strict';
import { test } from 'vitest';
import { InitService } from '#src/cli/app/init/init-service';
import { toJsonText } from '#test/helpers/json';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const service = new InitService(vfs);

	return {
		service,
		vfs,
	};
}

test('InitService creates the default config and work directory through the vfs', async () => {
	const { service, vfs } = sut();

	await service.init();

	const marsConfig = vfs.files.get('/repo/mars.config.json');
	const expectedConfig = toJsonText({
		namespace: 'app',
		envs_path: 'infra/envs',
		work_path: '.mars',
	});
	const hasMarsDir = vfs.directories.has('/repo/.mars');

	assert.equal(marsConfig, expectedConfig);
	assert.equal(hasMarsDir, true);
});

test('InitService skips existing config and work directory', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/custom-envs',
		work_path: '.mars-local',
	});

	vfs.setTextFile('mars.config.json', marsConfig);
	vfs.addDirectory('.mars-local');

	await service.init();

	const hasMarsLocalDir = vfs.directories.has('/repo/.mars-local');

	assert.equal(hasMarsLocalDir, true);
});

test('InitService uses the configured work_path from an existing config', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
		work_path: '.mars-local',
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	await service.init();

	const hasMarsLocalDir = vfs.directories.has('/repo/.mars-local');

	assert.equal(hasMarsLocalDir, true);
});

test('InitService defaults work_path when an existing config omits it', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		namespace: 'gl',
		envs_path: 'infra/envs',
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	await service.init();

	const hasMarsDir = vfs.directories.has('/repo/.mars');

	assert.equal(hasMarsDir, true);
});

test('InitService fails when the existing config is invalid', async () => {
	const { service, vfs } = sut();
	const marsConfig = toJsonText({
		work_path: '.mars',
	});

	vfs.setTextFile('mars.config.json', marsConfig);

	await assert.rejects(async () => {
		await service.init();
	});
});
