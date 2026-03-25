import assert from 'node:assert/strict';
import { test } from 'vitest';
import { EncryptedSecretRecord, PasswordSecretsKdfRecord } from '#src/cli/app/secrets/secrets-shapes';

test('EncryptedSecretRecord constructs from valid input', () => {
	const record = new EncryptedSecretRecord({
		algorithm: 'AES-GCM',
		ciphertext: 'abc123',
		iv: 'xyz789',
	});

	assert.equal(record.algorithm, 'AES-GCM');
	assert.equal(record.ciphertext, 'abc123');
	assert.equal(record.iv, 'xyz789');
});

test('EncryptedSecretRecord fails construction for invalid input', () => {
	assert.throws(() => {
		new EncryptedSecretRecord({
			ciphertext: 'abc123',
			iv: 'xyz789',
		});
	});
});

test('PasswordSecretsKdfRecord constructs from valid input', () => {
	const record = new PasswordSecretsKdfRecord({
		algorithm: 'argon2id',
		hash_length: 32,
		memory_cost: 65536,
		parallelism: 4,
		salt: 'salt',
		time_cost: 3,
	});

	assert.equal(record.algorithm, 'argon2id');
	assert.equal(record.hash_length, 32);
	assert.equal(record.memory_cost, 65536);
	assert.equal(record.parallelism, 4);
	assert.equal(record.salt, 'salt');
	assert.equal(record.time_cost, 3);
});

test('PasswordSecretsKdfRecord fails construction for invalid input', () => {
	assert.throws(() => {
		new PasswordSecretsKdfRecord({
			algorithm: 'argon2id',
			hash_length: 32,
		});
	});
});
