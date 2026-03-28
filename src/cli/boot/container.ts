import { KMSClient } from '@aws-sdk/client-kms';
import { S3Client } from '@aws-sdk/client-s3';
import { Tiny } from '@edo-w/tiny';
import { BackendBootstrapperFactory } from '#src/cli/app/backend/backend-bootstrapper-factory';
import { BackendFactory } from '#src/cli/app/backend/backend-factory';
import { ConfigService } from '#src/cli/app/config/config-service';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { InitService } from '#src/cli/app/init/init-service';
import { KeyAgentManager } from '#src/cli/app/key-agent/key-agent-manager';
import { KeyAgentServer } from '#src/cli/app/key-agent/key-agent-server';
import { KeyAgentService } from '#src/cli/app/key-agent/key-agent-service';
import { KvService } from '#src/cli/app/kv/kv-service';
import { KvSyncService } from '#src/cli/app/kv/kv-sync-service';
import { LockService } from '#src/cli/app/lock/lock-service';
import { KeyAgentSecretsService } from '#src/cli/app/secrets/key-agent-secrets-service';
import { KmsSecretsProvider } from '#src/cli/app/secrets/kms-secrets-provider';
import { PasswordSecretsProvider } from '#src/cli/app/secrets/password-secrets-provider';
import { SecretsBootstrapperFactory } from '#src/cli/app/secrets/secrets-bootstrapper-factory';
import { SecretsProviderFactory } from '#src/cli/app/secrets/secrets-provider-factory';
import { ISecretsService } from '#src/cli/app/secrets/secrets-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { StateService } from '#src/cli/app/state/state-service';
import { SshKeygen } from '#src/lib/ssh';
import { Tui } from '#src/lib/tui';
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
	container.addScopedFactory(KeyAgentManager, (t) => {
		const stateService = t.get(StateService);

		return new KeyAgentManager(stateService);
	});
	container.addScopedFactory(KeyAgentService, (t) => {
		const environmentService = t.get(EnvironmentService);
		const secretsProviderFactory = t.get(SecretsProviderFactory);

		return new KeyAgentService(environmentService, secretsProviderFactory);
	});
	container.addScopedFactory(KeyAgentServer, (t) => {
		const stateService = t.get(StateService);
		const keyAgentService = t.get(KeyAgentService);

		return new KeyAgentServer(stateService, keyAgentService);
	});
	container.addScopedFactory(KeyAgentSecretsService, (t) => {
		const keyAgentManager = t.get(KeyAgentManager);

		return new KeyAgentSecretsService(keyAgentManager);
	});
	container.addScopedFactory(ISecretsService, (t) => {
		const keyAgentSecretsService = t.get(KeyAgentSecretsService);

		return keyAgentSecretsService;
	});
	container.addSingletonClass(Tui, []);
	container.addScopedFactory(LockService, (t) => {
		const backendFactory = t.get(BackendFactory);

		return new LockService(backendFactory);
	});
	container.addScopedFactory(KvSyncService, (t) => {
		const vfs = t.get(Vfs);
		const configService = t.get(ConfigService);
		const backendFactory = t.get(BackendFactory);
		const lockService = t.get(LockService);

		return new KvSyncService(vfs, configService, backendFactory, lockService);
	});
	container.addScopedFactory(KvService, (t) => {
		const vfs = t.get(Vfs);
		const configService = t.get(ConfigService);
		const kvSyncService = t.get(KvSyncService);
		const secretsService = t.get(ISecretsService);

		return new KvService(vfs, configService, kvSyncService, secretsService);
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
