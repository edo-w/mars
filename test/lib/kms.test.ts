import assert from 'node:assert/strict';
import { test } from 'vitest';
import { isMissingKmsAliasError, isMissingKmsKeyError } from '#src/lib/kms';

test('isMissingKmsKeyError returns true for a missing KMS key error', () => {
	const error = {
		name: 'NotFoundException',
	};
	const result = isMissingKmsKeyError(error);

	assert.equal(result, true);
});

test('isMissingKmsKeyError returns false for a non-missing KMS key error', () => {
	const error = {
		name: 'AccessDeniedException',
	};
	const result = isMissingKmsKeyError(error);

	assert.equal(result, false);
});

test('isMissingKmsKeyError returns false for a non-object value', () => {
	const result = isMissingKmsKeyError(null);

	assert.equal(result, false);
});

test('isMissingKmsAliasError returns true for a missing KMS alias error', () => {
	const error = {
		name: 'NotFoundException',
	};
	const result = isMissingKmsAliasError(error);

	assert.equal(result, true);
});

test('isMissingKmsAliasError returns false for a non-missing KMS alias error', () => {
	const error = {
		name: 'ValidationException',
	};
	const result = isMissingKmsAliasError(error);

	assert.equal(result, false);
});

test('isMissingKmsAliasError returns false for a non-object value', () => {
	const result = isMissingKmsAliasError('boom');

	assert.equal(result, false);
});
