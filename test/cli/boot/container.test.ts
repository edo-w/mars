import assert from 'node:assert/strict';
import { KMSClient } from '@aws-sdk/client-kms';
import { S3Client } from '@aws-sdk/client-s3';
import { test } from 'vitest';
import { BackendBootstrapperFactory } from '#src/cli/app/backend/backend-bootstrapper-factory';
import { BackendFactory } from '#src/cli/app/backend/backend-factory';
import { ConfigService } from '#src/cli/app/config/config-service';
import { EnvironmentService } from '#src/cli/app/environment/environment-service';
import { InitService } from '#src/cli/app/init/init-service';
import { KeyAgentManager } from '#src/cli/app/key-agent/key-agent-manager';
import { KeyAgentServer } from '#src/cli/app/key-agent/key-agent-server';
import { KeyAgentService } from '#src/cli/app/key-agent/key-agent-service';
import { KeyAgentSecretsService } from '#src/cli/app/secrets/key-agent-secrets-service';
import { KmsSecretsProvider } from '#src/cli/app/secrets/kms-secrets-provider';
import { PasswordSecretsProvider } from '#src/cli/app/secrets/password-secrets-provider';
import { SecretsBootstrapperFactory } from '#src/cli/app/secrets/secrets-bootstrapper-factory';
import { SecretsProviderFactory } from '#src/cli/app/secrets/secrets-provider-factory';
import { ISecretsService } from '#src/cli/app/secrets/secrets-service';
import { SshCaService } from '#src/cli/app/ssh-ca/ssh-ca-service';
import { StateService } from '#src/cli/app/state/state-service';
import { createContainer } from '#src/cli/boot/container';
import { SshKeygen } from '#src/lib/ssh';
import { Tui } from '#src/lib/tui';
import { Vfs } from '#src/lib/vfs';

test('createContainer resolves the CLI services and shared infrastructure', () => {
	const container = createContainer({
		cwd: '/repo',
	});
	const scope = container.createScope();

	assert.equal(scope.get(Vfs).cwd, '/repo');
	assert.ok(scope.get(ConfigService) instanceof ConfigService);
	assert.ok(scope.get(InitService) instanceof InitService);
	assert.ok(scope.get(StateService) instanceof StateService);
	assert.ok(scope.get(SshKeygen) instanceof SshKeygen);
	assert.ok(scope.get(S3Client) instanceof S3Client);
	assert.ok(scope.get(KMSClient) instanceof KMSClient);
	assert.ok(scope.get(EnvironmentService) instanceof EnvironmentService);
	assert.ok(scope.get(BackendFactory) instanceof BackendFactory);
	assert.ok(scope.get(BackendBootstrapperFactory) instanceof BackendBootstrapperFactory);
	assert.ok(scope.get(PasswordSecretsProvider) instanceof PasswordSecretsProvider);
	assert.ok(scope.get(KmsSecretsProvider) instanceof KmsSecretsProvider);
	assert.ok(scope.get(SecretsProviderFactory) instanceof SecretsProviderFactory);
	assert.ok(scope.get(KeyAgentManager) instanceof KeyAgentManager);
	assert.ok(scope.get(KeyAgentService) instanceof KeyAgentService);
	assert.ok(scope.get(KeyAgentServer) instanceof KeyAgentServer);
	assert.ok(scope.get(KeyAgentSecretsService) instanceof KeyAgentSecretsService);
	assert.notEqual(scope.get(ISecretsService), null);
	assert.ok(scope.get(Tui) instanceof Tui);
	assert.ok(scope.get(SecretsBootstrapperFactory) instanceof SecretsBootstrapperFactory);
	assert.ok(scope.get(SshCaService) instanceof SshCaService);
});
