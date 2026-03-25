import { S3Client } from '@aws-sdk/client-s3';
import type { TinyContext } from '@edo-w/tiny';
import type { BackendBootstrapper } from '#src/cli/app/backend/backend-bootstrapper';
import { LocalBackendBootstrapper } from '#src/cli/app/backend/local-backend-bootstrapper';
import { S3BackendBootstrapper } from '#src/cli/app/backend/s3-backend-bootstrapper';
import { ConfigService } from '#src/cli/app/config/config-service';
import { isLocalBackendConfig, isS3BackendConfig } from '#src/cli/app/config/config-shapes';

export class BackendBootstrapperFactory {
	container: TinyContext;

	constructor(container: TinyContext) {
		this.container = container;
	}

	async create(): Promise<BackendBootstrapper> {
		const configService = this.container.get(ConfigService);
		const config = await configService.get();

		if (isLocalBackendConfig(config.backend)) {
			return new LocalBackendBootstrapper();
		}

		if (isS3BackendConfig(config.backend)) {
			const s3Client = this.container.get(S3Client);

			return new S3BackendBootstrapper(configService, s3Client);
		}

		throw new Error('Unsupported backend config');
	}
}
