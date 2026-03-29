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
import { NodeService } from '#src/cli/app/node/node-service';
import { NodeSyncService } from '#src/cli/app/node/node-sync-service';
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
	container.addScopedClass(EnvironmentService, [Vfs, ConfigService, StateService]);
	container.addScopedFactory(BackendFactory, (t) => {
		return new BackendFactory(t);
	});
	container.addScopedFactory(BackendBootstrapperFactory, (t) => {
		return new BackendBootstrapperFactory(t);
	});
	container.addScopedClass(PasswordSecretsProvider, [BackendFactory]);
	container.addScopedClass(KmsSecretsProvider, [BackendFactory, KMSClient]);
	container.addScopedFactory(SecretsProviderFactory, (t) => {
		return new SecretsProviderFactory(t);
	});
	container.addScopedClass(KeyAgentManager, [StateService]);
	container.addScopedClass(KeyAgentService, [EnvironmentService, SecretsProviderFactory]);
	container.addScopedClass(KeyAgentServer, [StateService, KeyAgentService]);
	container.addScopedClass(KeyAgentSecretsService, [KeyAgentManager]);
	container.addScopedFactory(ISecretsService, (t) => {
		const keyAgentSecretsService = t.get(KeyAgentSecretsService);

		return keyAgentSecretsService;
	});
	container.addSingletonClass(Tui, []);
	container.addScopedClass(LockService, [BackendFactory]);
	container.addScopedClass(KvSyncService, [Vfs, ConfigService, BackendFactory, LockService]);
	container.addScopedClass(KvService, [Vfs, ConfigService, KvSyncService, ISecretsService]);
	container.addScopedClass(NodeSyncService, [Vfs, ConfigService, BackendFactory, LockService]);
	container.addScopedClass(NodeService, [Vfs, ConfigService, NodeSyncService]);
	container.addScopedFactory(SecretsBootstrapperFactory, (t) => {
		return new SecretsBootstrapperFactory(t);
	});
	container.addScopedClass(SshCaService, [Vfs, ConfigService, BackendFactory, ISecretsService, SshKeygen]);

	return container;
}
