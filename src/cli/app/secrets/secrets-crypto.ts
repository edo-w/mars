import {
	AES_GCM_ALGORITHM,
	AES_GCM_IV_LENGTH,
	EncryptedSecretRecord,
	fromBase64,
	toBase64,
} from '#src/cli/app/secrets/secrets-shapes';

export async function encryptBytes(keyBytes: Uint8Array, plaintext: Uint8Array): Promise<EncryptedSecretRecord> {
	const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
	const cryptoKey = await crypto.subtle.importKey('raw', Buffer.from(keyBytes), AES_GCM_ALGORITHM, false, [
		'encrypt',
	]);
	const ciphertext = await crypto.subtle.encrypt(
		{
			iv: Buffer.from(iv),
			name: AES_GCM_ALGORITHM,
		},
		cryptoKey,
		Buffer.from(plaintext),
	);

	return new EncryptedSecretRecord({
		algorithm: AES_GCM_ALGORITHM,
		ciphertext: toBase64(new Uint8Array(ciphertext)),
		iv: toBase64(iv),
	});
}

export async function decryptBytes(keyBytes: Uint8Array, encryptedSecret: EncryptedSecretRecord): Promise<Uint8Array> {
	const cryptoKey = await crypto.subtle.importKey('raw', Buffer.from(keyBytes), encryptedSecret.algorithm, false, [
		'decrypt',
	]);
	const plaintext = await crypto.subtle.decrypt(
		{
			iv: Buffer.from(fromBase64(encryptedSecret.iv)),
			name: encryptedSecret.algorithm,
		},
		cryptoKey,
		Buffer.from(fromBase64(encryptedSecret.ciphertext)),
	);

	return new Uint8Array(plaintext);
}
