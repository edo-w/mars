import type { TinyContext } from '@edo-w/tiny';
import { ConfigService } from '#src/cli/app/config/config-service';
import { isKmsSecretsConfig, isPasswordSecretsConfig } from '#src/cli/app/config/config-shapes';
import { KmsSecretsProvider } from '#src/cli/app/secrets/kms-secrets-provider';
import { PasswordSecretsProvider } from '#src/cli/app/secrets/password-secrets-provider';
import type { SecretsProvider } from '#src/cli/app/secrets/secrets-provider';

export class SecretsProviderFactory {
	container: TinyContext;

	constructor(container: TinyContext) {
		this.container = container;
	}

	async create(): Promise<SecretsProvider> {
		const configService = this.container.get(ConfigService);
		const config = await configService.get();

		if (isPasswordSecretsConfig(config.secrets)) {
			return this.container.get(PasswordSecretsProvider);
		}

		if (isKmsSecretsConfig(config.secrets)) {
			return this.container.get(KmsSecretsProvider);
		}

		throw new Error('Unsupported secrets config');
	}
}
