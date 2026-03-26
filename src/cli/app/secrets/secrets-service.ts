import { createKey } from '@edo-w/tiny';
import type { Environment } from '#src/cli/app/environment/environment-shapes';
import type { EncryptedSecretRecord } from '#src/cli/app/secrets/secrets-shapes';

export interface SecretsService {
	decryptText(environment: Environment, encryptedSecret: EncryptedSecretRecord): Promise<string>;
	encryptText(environment: Environment, plaintext: string): Promise<EncryptedSecretRecord>;
}

export const ISecretsService = createKey<SecretsService>('SecretsService');
