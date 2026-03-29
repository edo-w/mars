import { KMSClient } from '@aws-sdk/client-kms';
import type { TinyContext } from '@edo-w/tiny';
import { ConfigService } from '#src/app/config/config-service';
import { isKmsSecretsConfig, isPasswordSecretsConfig } from '#src/app/config/config-shapes';
import { KmsSecretsBootstrapper } from '#src/app/secrets/kms-secrets-bootstrapper';
import { PasswordSecretsBootstrapper } from '#src/app/secrets/password-secrets-bootstrapper';
import type { SecretsBootstrapper } from '#src/app/secrets/secrets-bootstrapper';

export class SecretsBootstrapperFactory {
	container: TinyContext;

	constructor(container: TinyContext) {
		this.container = container;
	}

	async create(): Promise<SecretsBootstrapper> {
		const configService = this.container.get(ConfigService);
		const config = await configService.get();

		if (isPasswordSecretsConfig(config.secrets)) {
			return new PasswordSecretsBootstrapper();
		}

		if (isKmsSecretsConfig(config.secrets)) {
			const kmsClient = this.container.get(KMSClient);

			return new KmsSecretsBootstrapper(kmsClient);
		}

		throw new Error('Unsupported secrets config');
	}
}
