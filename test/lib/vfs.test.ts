import assert from 'node:assert/strict';
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
