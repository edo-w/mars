import { KMSClient } from '@aws-sdk/client-kms';
import { S3Client } from '@aws-sdk/client-s3';
import { Tiny } from '@edo-w/tiny';
import { BackendBootstrapperFactory } from '#src/app/backend/backend-bootstrapper-factory';
import { BackendFactory } from '#src/app/backend/backend-factory';
import { ConfigService } from '#src/app/config/config-service';
import { EnvironmentService } from '#src/app/environment/environment-service';
import { InitService } from '#src/app/init/init-service';
import { KeyAgentClientFactory } from '#src/app/key-agent/key-agent-client-factory';
import { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import { KeyAgentServer } from '#src/app/key-agent/key-agent-server';
import { KeyAgentService } from '#src/app/key-agent/key-agent-service';
import { KvService } from '#src/app/kv/kv-service';
import { KvSyncService } from '#src/app/kv/kv-sync-service';
import { LockService } from '#src/app/lock/lock-service';
import { NodeService } from '#src/app/node/node-service';
import { NodeSyncService } from '#src/app/node/node-sync-service';
import { PlaybookService } from '#src/app/playbook/playbook-service';
import { PlaybookSshClientFactory } from '#src/app/playbook/playbook-ssh-client';
import { PlaybookTaskHandlerFactory } from '#src/app/playbook/playbook-task-handler-factory';
import { PlaybookTaskRegistry } from '#src/app/playbook/playbook-task-registry';
import { EchowaitTaskHandler } from '#src/app/playbook/tasks/echowait';
import { KeyAgentSecretsService } from '#src/app/secrets/key-agent-secrets-service';
import { KmsSecretsProvider } from '#src/app/secrets/kms-secrets-provider';
import { PasswordSecretsProvider } from '#src/app/secrets/password-secrets-provider';
import { SecretsBootstrapperFactory } from '#src/app/secrets/secrets-bootstrapper-factory';
import { SecretsProviderFactory } from '#src/app/secrets/secrets-provider-factory';
import { ISecretsService } from '#src/app/secrets/secrets-service';
import { SshCaService } from '#src/app/ssh-ca/ssh-ca-service';
import { StateService } from '#src/app/state/state-service';
import { SshKeygen } from '#src/lib/ssh';
import { Tui } from '#src/lib/tui';
import { Vfs } from '#src/lib/vfs';
import { VProcess } from '#src/lib/vprocess';
import { VTimer } from '#src/lib/vtimer';

export interface CreateContainerOptions {
	cwd: string;
}

export function createContainer(options: CreateContainerOptions): Tiny {
	const container = new Tiny();

	container.addSingletonFactory(Vfs, () => {
		return new Vfs(options.cwd);
	});
	container.addSingletonClass(VProcess, []);
	container.addSingletonClass(VTimer, []);
	container.addSingletonClass(ConfigService, [Vfs]);
	container.addScopedClass(InitService, [Vfs]);
	container.addScopedClass(StateService, [Vfs, ConfigService]);
	container.addSingletonClass(SshKeygen, [VProcess]);
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
	container.addScopedClass(KeyAgentClientFactory, [VTimer]);
	container.addScopedClass(KeyAgentManager, [StateService, VProcess, KeyAgentClientFactory, VTimer]);
	container.addScopedClass(KeyAgentService, [EnvironmentService, SecretsProviderFactory]);
	container.addScopedClass(KeyAgentServer, [StateService, KeyAgentService, VTimer]);
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
	container.addSingletonClass(PlaybookTaskRegistry, []);
	container.addScopedClass(EchowaitTaskHandler, []);
	container.addScopedClass(PlaybookSshClientFactory, [VTimer]);
	container.addScopedFactory(PlaybookTaskHandlerFactory, (t) => {
		return new PlaybookTaskHandlerFactory(container, t.get(PlaybookTaskRegistry));
	});
	container.addScopedClass(PlaybookService, [
		Vfs,
		ConfigService,
		NodeService,
		SshCaService,
		PlaybookSshClientFactory,
		PlaybookTaskHandlerFactory,
	]);
	container.addScopedFactory(SecretsBootstrapperFactory, (t) => {
		return new SecretsBootstrapperFactory(t);
	});
	container.addScopedClass(SshCaService, [
		Vfs,
		ConfigService,
		BackendFactory,
		KeyAgentManager,
		ISecretsService,
		SshKeygen,
	]);
	container.get(PlaybookTaskRegistry).register('echowait', EchowaitTaskHandler);

	return container;
}
