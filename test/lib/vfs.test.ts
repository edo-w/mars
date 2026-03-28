import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { isMissingPathError, Vfs } from '#src/lib/vfs';

test('isMissingPathError returns true for ENOENT errors', () => {
	const error = new Error('missing') as NodeJS.ErrnoException;

	error.code = 'ENOENT';

	assert.equal(isMissingPathError(error), true);
});

test('Vfs resolves paths from cwd', () => {
	const vfs = new Vfs('/repo');
	const configPath = vfs.resolve('mars.config.json');
	const expectedPath = path.resolve('/repo', 'mars.config.json');

	assert.equal(configPath, expectedPath);
});

test('isMissingPathError returns false for non-ENOENT errors', () => {
	const error = new Error('other') as NodeJS.ErrnoException;

	error.code = 'EACCES';

	assert.equal(isMissingPathError(error), false);
});

test('isMissingPathError returns false for non-errors', () => {
	assert.equal(isMissingPathError({ code: 'ENOENT' }), false);
});

test('Vfs writes and reads a text file', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-vfs-'));
	const vfs = new Vfs(tempDir);

	try {
		await vfs.writeTextFile('nested/file.txt', 'hello');

		const fileContents = await vfs.readTextFile('nested/file.txt');

		assert.equal(fileContents, 'hello');
	} finally {
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('Vfs writes and reads a binary file', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-vfs-'));
	const vfs = new Vfs(tempDir);
	const fileBytes = new Uint8Array([0, 1, 2, 3]);

	try {
		await vfs.writeFile('nested/file.bin', fileBytes);

		const nextFileBytes = await vfs.readFile('nested/file.bin');

		assert.deepEqual([...nextFileBytes], [0, 1, 2, 3]);
	} finally {
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('Vfs ensureDirectory and directoryExists work together', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-vfs-'));
	const vfs = new Vfs(tempDir);

	try {
		await vfs.ensureDirectory('nested/dir');

		const hasDirectory = await vfs.directoryExists('nested/dir');

		assert.equal(hasDirectory, true);
	} finally {
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('Vfs fileExists returns true for an existing file', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-vfs-'));
	const vfs = new Vfs(tempDir);

	try {
		await fsp.writeFile(path.join(tempDir, 'file.txt'), 'hello', 'utf8');

		const hasFile = await vfs.fileExists('file.txt');

		assert.equal(hasFile, true);
	} finally {
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('Vfs listDirectory returns the directory entries', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-vfs-'));
	const vfs = new Vfs(tempDir);

	try {
		await fsp.mkdir(path.join(tempDir, 'dir'));
		await fsp.writeFile(path.join(tempDir, 'dir', 'a.txt'), 'a', 'utf8');
		await fsp.writeFile(path.join(tempDir, 'dir', 'b.txt'), 'b', 'utf8');

		const entries = await vfs.listDirectory('dir');

		assert.deepEqual(entries.sort(), ['a.txt', 'b.txt']);
	} finally {
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('Vfs listDirectory returns an empty list for a missing directory', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-vfs-'));
	const vfs = new Vfs(tempDir);

	try {
		const entries = await vfs.listDirectory('missing');

		assert.deepEqual(entries, []);
	} finally {
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('Vfs removeFile removes an existing file', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-vfs-'));
	const vfs = new Vfs(tempDir);

	try {
		await fsp.writeFile(path.join(tempDir, 'file.txt'), 'hello', 'utf8');

		await vfs.removeFile('file.txt');

		const hasFile = await vfs.fileExists('file.txt');

		assert.equal(hasFile, false);
	} finally {
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('Vfs removeFile ignores missing files', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-vfs-'));
	const vfs = new Vfs(tempDir);

	try {
		await vfs.removeFile('missing.txt');

		assert.ok(true);
	} finally {
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});

test('Vfs removeDirectory removes an existing directory tree', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-vfs-'));
	const vfs = new Vfs(tempDir);

	try {
		await vfs.writeTextFile('nested/dir/file.txt', 'hello');

		await vfs.removeDirectory('nested');

		const hasDirectory = await vfs.directoryExists('nested');
		const hasFile = await vfs.fileExists('nested/dir/file.txt');

		assert.equal(hasDirectory, false);
		assert.equal(hasFile, false);
	} finally {
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});
