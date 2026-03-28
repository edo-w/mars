import { createKey } from '@edo-w/tiny';
import type { Environment } from '#src/cli/app/environment/environment-shapes';
import type { EncryptedSecretRecord } from '#src/cli/app/secrets/secrets-shapes';

export interface SecretsService {
	decryptBytes(environment: Environment, encryptedSecret: EncryptedSecretRecord): Promise<Uint8Array>;
	decryptText(environment: Environment, encryptedSecret: EncryptedSecretRecord): Promise<string>;
	encryptBytes(environment: Environment, plaintext: Uint8Array): Promise<EncryptedSecretRecord>;
	encryptText(environment: Environment, plaintext: string): Promise<EncryptedSecretRecord>;
}

export const ISecretsService = createKey<SecretsService>('SecretsService');
