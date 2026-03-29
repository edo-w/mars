import {
	CreateAliasCommand,
	CreateKeyCommand,
	DeleteAliasCommand,
	DescribeKeyCommand,
	DisableKeyCommand,
	EnableKeyRotationCommand,
	type KMSClient,
	ScheduleKeyDeletionCommand,
} from '@aws-sdk/client-kms';
import type { Environment, EnvironmentResource } from '#src/app/environment/environment-shapes';
import type {
	SecretsBootstrapper,
	SecretsBootstrapResult,
	SecretsDestroyResult,
} from '#src/app/secrets/secrets-bootstrapper';
import { createKmsKeyResource } from '#src/app/secrets/secrets-bootstrapper-shapes';
import { createKmsSecretsKeyAlias } from '#src/app/secrets/secrets-shapes';
import { isMissingKmsAliasError, isMissingKmsKeyError } from '#src/lib/kms';

export class KmsSecretsBootstrapper implements SecretsBootstrapper {
	kmsClient: KMSClient;

	constructor(kmsClient: KMSClient) {
		this.kmsClient = kmsClient;
	}

	async bootstrap(environment: Environment): Promise<SecretsBootstrapResult> {
		const keyAlias = createKmsSecretsKeyAlias(environment.id);
		const resourceLabel = `kms key "${keyAlias}"`;

		if (await this.keyExists(keyAlias)) {
			return {
				kind: 'already_exists',
				resource_label: resourceLabel,
			};
		}

		const keyId = await this.createKey(environment.id);

		await this.enableKeyRotation(keyId);
		await this.createAlias(keyAlias, keyId);

		return {
			kind: 'created',
			resource_label: resourceLabel,
		};
	}

	async describeDestroy(environment: Environment): Promise<EnvironmentResource[]> {
		const keyAlias = createKmsSecretsKeyAlias(environment.id);

		return [createKmsKeyResource(keyAlias, 'destroy')];
	}

	async destroy(environment: Environment): Promise<SecretsDestroyResult> {
		const keyAlias = createKmsSecretsKeyAlias(environment.id);
		const resources: EnvironmentResource[] = [];
		const keyId = await this.getKeyId(keyAlias);

		if (keyId === null) {
			resources.push(createKmsKeyResource(keyAlias, 'not_found'));

			return {
				kind: 'success',
				resources,
			};
		}

		try {
			await this.deleteAlias(keyAlias);
			await this.disableKey(keyId);
			await this.scheduleKeyDeletion(keyId);
			resources.push(createKmsKeyResource(keyAlias, 'destroy'));

			return {
				kind: 'success',
				resources,
			};
		} catch (error) {
			return {
				error,
				kind: 'fail',
				resources,
			};
		}
	}

	private async createAlias(keyAlias: string, keyId: string): Promise<void> {
		await this.kmsClient.send(
			new CreateAliasCommand({
				AliasName: keyAlias,
				TargetKeyId: keyId,
			}),
		);
	}

	private async createKey(environmentId: string): Promise<string> {
		const result = await this.kmsClient.send(
			new CreateKeyCommand({
				Description: `Mars secrets key for ${environmentId}`,
				KeySpec: 'SYMMETRIC_DEFAULT',
				KeyUsage: 'ENCRYPT_DECRYPT',
			}),
		);
		const keyId = result.KeyMetadata?.KeyId;

		if (keyId === undefined) {
			throw new Error(`failed to create kms key for "${environmentId}"`);
		}

		return keyId;
	}

	private async deleteAlias(keyAlias: string): Promise<void> {
		try {
			await this.kmsClient.send(
				new DeleteAliasCommand({
					AliasName: keyAlias,
				}),
			);
		} catch (error) {
			if (!isMissingKmsAliasError(error)) {
				throw error;
			}
		}
	}

	private async disableKey(keyId: string): Promise<void> {
		await this.kmsClient.send(
			new DisableKeyCommand({
				KeyId: keyId,
			}),
		);
	}

	private async enableKeyRotation(keyId: string): Promise<void> {
		await this.kmsClient.send(
			new EnableKeyRotationCommand({
				KeyId: keyId,
			}),
		);
	}

	private async getKeyId(keyAlias: string): Promise<string | null> {
		try {
			const result = await this.kmsClient.send(
				new DescribeKeyCommand({
					KeyId: keyAlias,
				}),
			);
			const keyId = result.KeyMetadata?.KeyId;

			return keyId ?? null;
		} catch (error) {
			if (!isMissingKmsKeyError(error)) {
				throw error;
			}

			return null;
		}
	}

	private async keyExists(keyAlias: string): Promise<boolean> {
		const keyId = await this.getKeyId(keyAlias);

		return keyId !== null;
	}

	private async scheduleKeyDeletion(keyId: string): Promise<void> {
		await this.kmsClient.send(
			new ScheduleKeyDeletionCommand({
				KeyId: keyId,
				PendingWindowInDays: 7,
			}),
		);
	}
}
