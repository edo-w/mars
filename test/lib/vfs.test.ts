import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'vitest';
import { isMissingPathError, NodeVfs } from '#src/lib/vfs';

test('isMissingPathError returns true for ENOENT errors', () => {
	const error = new Error('missing') as NodeJS.ErrnoException;

	error.code = 'ENOENT';

	assert.equal(isMissingPathError(error), true);
});

test('NodeVfs resolves paths from cwd', () => {
	const vfs = new NodeVfs('/repo');

	assert.equal(vfs.resolve('mars.config.json'), path.resolve('/repo', 'mars.config.json'));
});

test('isMissingPathError returns false for non-ENOENT errors', () => {
	const error = new Error('other') as NodeJS.ErrnoException;

	error.code = 'EACCES';

	assert.equal(isMissingPathError(error), false);
});

test('isMissingPathError returns false for non-errors', () => {
	assert.equal(isMissingPathError({ code: 'ENOENT' }), false);
});
