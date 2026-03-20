import assert from 'node:assert/strict';
import { test } from 'vitest';
import { InitService } from '#src/cli/app/init/init-service';
import type { Vfs } from '#src/lib/vfs';

test('InitService creates the default config and work directory through the vfs', async () => {
	const vfs = new FakeVfs();
	const service = new InitService(vfs);

	await service.init();

	const marsConfig = vfs.files.get('/repo/mars.config.json');
	const expectedConfig = toJsonText({
		stack_path: 'infra/stacks',
		work_path: '.mars',
	});
	const hasMarsDir = vfs.directories.has('/repo/.mars');

	assert.equal(marsConfig, expectedConfig);
	assert.equal(hasMarsDir, true);
});

test('InitService skips existing config and work directory', async () => {
	const vfs = new FakeVfs();
	const service = new InitService(vfs);
	const marsConfig = toJsonText({
		stack_path: 'infra/stacks',
		work_path: '.mars',
	});

	vfs.files.set('/repo/mars.config.json', marsConfig);
	vfs.directories.add('/repo/.mars');

	await service.init();
});

test('InitService uses the configured work_path from an existing config', async () => {
	const vfs = new FakeVfs();
	const service = new InitService(vfs);
	const marsConfig = toJsonText({
		stack_path: 'infra/stacks',
		work_path: '.mars-local',
	});

	vfs.files.set('/repo/mars.config.json', marsConfig);

	await service.init();

	const hasMarsLocalDir = vfs.directories.has('/repo/.mars-local');

	assert.equal(hasMarsLocalDir, true);
});

test('InitService defaults work_path when an existing config omits it', async () => {
	const vfs = new FakeVfs();
	const service = new InitService(vfs);
	const marsConfig = toJsonText({
		stack_path: 'infra/stacks',
	});

	vfs.files.set('/repo/mars.config.json', marsConfig);

	await service.init();
});

test('InitService fails when the existing config is invalid', async () => {
	const vfs = new FakeVfs();
	const service = new InitService(vfs);
	const marsConfig = toJsonText({
		work_path: '.mars',
	});

	vfs.files.set('/repo/mars.config.json', marsConfig);

	await assert.rejects(async () => {
		await service.init();
	});
});

class FakeVfs implements Vfs {
	cwd: string;
	directories: Set<string>;
	files: Map<string, string>;

	constructor() {
		this.cwd = '/repo';
		this.directories = new Set(['/repo']);
		this.files = new Map();
	}

	async directoryExists(targetPath: string): Promise<boolean> {
		return this.directories.has(this.resolve(targetPath));
	}

	async ensureDirectory(targetPath: string): Promise<void> {
		this.directories.add(this.resolve(targetPath));
	}

	async fileExists(targetPath: string): Promise<boolean> {
		return this.files.has(this.resolve(targetPath));
	}

	async readTextFile(targetPath: string): Promise<string> {
		const contents = this.files.get(this.resolve(targetPath));

		if (contents === undefined) {
			throw new Error(`Missing file: ${targetPath}`);
		}

		return contents;
	}

	resolve(...pathParts: string[]): string {
		return [this.cwd, ...pathParts].join('/').replaceAll('//', '/').replace('/./', '/');
	}

	async writeTextFile(targetPath: string, contents: string): Promise<void> {
		const resolvedPath = this.resolve(targetPath);
		const segments = resolvedPath.split('/').filter(Boolean);

		if (segments.length > 1) {
			const directoryPath = `/${segments.slice(0, -1).join('/')}`;

			this.directories.add(directoryPath);
		}

		this.files.set(resolvedPath, contents);
	}
}

function toJsonText(fields: Record<string, unknown>): string {
	return `${JSON.stringify(fields, null, 2)}\n`;
}
