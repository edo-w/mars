import { KMSClient } from '@aws-sdk/client-kms';
import { S3Client } from '@aws-sdk/client-s3';
import { Tiny } from '@edo-w/tiny';
import { BackendBootstrapperFactory } from '#src/cli/app/backend/backend-bootstrapper-factory';
import { BackendFactory } from '#src/cli/app/backend/backend-factory';
import { ConfigService } from '#src/cli/app/config/config-service';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { InitService } from '#src/cli/app/init/init-service';
import { KeyAgentSecretsService } from '#src/cli/app/secrets/key-agent-secrets-service';
import { KmsSecretsProvider } from '#src/cli/app/secrets/kms-secrets-provider';
import { PasswordSecretsProvider } from '#src/cli/app/secrets/password-secrets-provider';
import { SecretsBootstrapperFactory } from '#src/cli/app/secrets/secrets-bootstrapper-factory';
import { SecretsProviderFactory } from '#src/cli/app/secrets/secrets-provider-factory';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { StateService } from '#src/cli/app/state/state-service';
import { SshKeygen } from '#src/lib/ssh';
import { Vfs } from '#src/lib/vfs';

export interface CreateContainerOptions {
	cwd: string;
}

export function createContainer(options: CreateContainerOptions): Tiny {
	const container = new Tiny();

	container.addSingletonFactory(Vfs, () => {
		return new Vfs(options.cwd);
	});
	container.addSingletonClass(ConfigService, [Vfs]);
	container.addScopedClass(InitService, [Vfs]);
	container.addScopedClass(StateService, [Vfs, ConfigService]);
	container.addSingletonClass(SshKeygen, []);
	container.addScopedFactory(S3Client, () => {
		return new S3Client({});
	});
	container.addScopedFactory(KMSClient, () => {
		return new KMSClient({});
	});
	container.addScopedFactory(EnvironmentService, (t) => {
		const vfs = t.get(Vfs);
		const configService = t.get(ConfigService);
		const stateService = t.get(StateService);

		return new EnvironmentService(vfs, configService, stateService);
	});
	container.addScopedFactory(BackendFactory, (t) => {
		return new BackendFactory(t);
	});
	container.addScopedFactory(BackendBootstrapperFactory, (t) => {
		return new BackendBootstrapperFactory(t);
	});
	container.addScopedFactory(PasswordSecretsProvider, (t) => {
		const backendFactory = t.get(BackendFactory);

		return new PasswordSecretsProvider(backendFactory);
	});
	container.addScopedFactory(KmsSecretsProvider, (t) => {
		const backendFactory = t.get(BackendFactory);
		const kmsClient = t.get(KMSClient);

		return new KmsSecretsProvider(backendFactory, kmsClient);
	});
	container.addScopedFactory(SecretsProviderFactory, (t) => {
		return new SecretsProviderFactory(t);
	});
	container.addScopedFactory(KeyAgentSecretsService, (t) => {
		const secretsProviderFactory = t.get(SecretsProviderFactory);

		return new KeyAgentSecretsService(secretsProviderFactory);
	});
	container.addScopedFactory(SecretsBootstrapperFactory, (t) => {
		return new SecretsBootstrapperFactory(t);
	});
	container.addScopedFactory(SshCaService, (t) => {
		const vfs = t.get(Vfs);
		const configService = t.get(ConfigService);
		const backendFactory = t.get(BackendFactory);
		const sshKeygen = t.get(SshKeygen);

		return new SshCaService(vfs, configService, backendFactory, sshKeygen);
	});

	return container;
}
