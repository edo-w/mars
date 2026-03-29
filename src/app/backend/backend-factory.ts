import { S3Client } from '@aws-sdk/client-s3';
import type { TinyContext } from '@edo-w/tiny';
import type { BackendService } from '#src/app/backend/backend-service';
import { LocalBackendService } from '#src/app/backend/local-backend-service';
import { S3BackendService } from '#src/app/backend/s3-backend-service';
import { ConfigService } from '#src/app/config/config-service';
import { isLocalBackendConfig, isS3BackendConfig } from '#src/app/config/config-shapes';
import { Vfs } from '#src/lib/vfs';

export class BackendFactory {
	container: TinyContext;

	constructor(container: TinyContext) {
		this.container = container;
	}

	async create(): Promise<BackendService> {
		const configService = this.container.get(ConfigService);
		const config = await configService.get();

		if (isLocalBackendConfig(config.backend)) {
			const vfs = this.container.get(Vfs);

			return new LocalBackendService(vfs, configService);
		}

		if (isS3BackendConfig(config.backend)) {
			const vfs = this.container.get(Vfs);
			const s3Client = this.container.get(S3Client);

			return new S3BackendService(vfs, configService, s3Client);
		}

		throw new Error('Unsupported backend config');
	}
}
