import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { SshKeygen } from '#src/lib/ssh';

test('SshKeygen generates an ed25519 keypair into the target path', async () => {
	const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mars-ssh-keygen-'));
	const privateKeyPath = path.join(tempDir, 'test_ca_ed25519.key');
	const sshKeygen = new SshKeygen();

	try {
		await sshKeygen.generateKeyPair({
			comment: 'mars test ssh ca',
			passphrase: 'test-passphrase',
			privateKeyPath,
		});

		const hasPrivateKey = await fsp
			.stat(privateKeyPath)
			.then((entry) => entry.isFile())
			.catch(() => false);
		const hasPublicKey = await fsp
			.stat(`${privateKeyPath}.pub`)
			.then((entry) => entry.isFile())
			.catch(() => false);

		assert.equal(hasPrivateKey, true);
		assert.equal(hasPublicKey, true);
	} finally {
		await fsp.rm(tempDir, {
			force: true,
			recursive: true,
		});
	}
});
