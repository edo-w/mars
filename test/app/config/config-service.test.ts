import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ConfigService } from '#src/app/config/config-service';
import { toMarsConfigText } from '#test/helpers/mars-config';
import { MockVfs } from '#test/mocks/mock-vfs';

function sut() {
	const vfs = new MockVfs();
	const service = new ConfigService(vfs);

	return {
		service,
		vfs,
	};
}

test('ConfigService loads and caches the mars config', async () => {
	const { service, vfs } = sut();
	const firstConfig = toMarsConfigText({
		namespace: 'gl',
	});
	const secondConfig = toMarsConfigText({
		namespace: 'app',
	});

	vfs.setTextFile('mars.config.json', firstConfig);

	const config = await service.get();

	vfs.setTextFile('mars.config.json', secondConfig);

	const cachedConfig = await service.get();

	assert.equal(config.namespace, 'gl');
	assert.equal(cachedConfig.namespace, 'gl');
});
