import path from 'node:path';
import {
	CreateBucketCommand,
	HeadBucketCommand,
	PutBucketEncryptionCommand,
	PutBucketPolicyCommand,
	PutPublicAccessBlockCommand,
	type S3Client,
} from '@aws-sdk/client-s3';
import { parse, stringify } from 'yaml';
import {
	type BootstrapEnvironmentBucketResult,
	ENVIRONMENT_FILE,
	type Environment,
	EnvironmentConfig,
} from '#src/cli/app/environment/environment-shapes';
import type { StateService } from '#src/cli/app/state/state-service';
import { type MarsConfig, readMarsConfig } from '#src/cli/boot/config';
import { normalizePath } from '#src/lib/fs';
import { isMissingBucketError } from '#src/lib/s3';
import type { Vfs } from '#src/lib/vfs';

export class EnvironmentService {
	s3Client: S3Client;
	stateService: StateService;
	vfs: Vfs;

	constructor(vfs: Vfs, stateService: StateService, s3Client: S3Client) {
		this.s3Client = s3Client;
		this.vfs = vfs;
		this.stateService = stateService;
	}

	async create(name: string): Promise<Environment | null> {
		const config = await readMarsConfig(this.vfs);
		const directoryPath = path.posix.join(normalizePath(config.envs_path), normalizePath(name));
		const configPath = path.posix.join(directoryPath, ENVIRONMENT_FILE);

		if (await this.vfs.fileExists(configPath)) {
			return null;
		}

		const environmentConfig = new EnvironmentConfig({
			name,
			namespace: config.namespace,
			aws_account_id: 'TODO',
			aws_region: 'TODO',
		});
		const environmentContents = stringify({
			namespace: environmentConfig.namespace,
			name: environmentConfig.name,
			aws_account_id: environmentConfig.aws_account_id,
			aws_region: environmentConfig.aws_region,
		});

		await this.vfs.ensureDirectory(directoryPath);
		await this.vfs.writeTextFile(configPath, environmentContents);

		return {
			config: environmentConfig,
			configPath,
			directoryPath,
			id: environmentConfig.id,
			selected: false,
		};
	}

	async get(name: string): Promise<Environment | null> {
		const environments = await this.list();

		return environments.find((environment) => environment.id === name) ?? null;
	}

	async bootstrap(name: string | null): Promise<BootstrapEnvironmentBucketResult> {
		const environment = await this.resolveForBootstrap(name);

		if (environment === null) {
			if (name === null) {
				return {
					kind: 'not_selected',
				};
			}

			return {
				kind: 'not_found',
				name,
			};
		}

		const config = await readMarsConfig(this.vfs);
		const bucket = this.renderBootstrapBucketName(environment, config);

		if (await this.bucketExists(bucket)) {
			return {
				bucket,
				kind: 'already_exists',
			};
		}

		await this.createBucket(bucket);
		await this.enableBucketEncryption(bucket);
		await this.enableBucketPublicAccessBlock(bucket);
		await this.enableBucketTlsEnforcement(bucket);

		return {
			bucket,
			kind: 'created',
		};
	}

	async getCurrent(): Promise<Environment | null> {
		const selectedEnvironmentPath = await this.stateService.getSelectedEnvironmentPath();

		if (selectedEnvironmentPath === null) {
			return null;
		}

		return this.readEnvironment(selectedEnvironmentPath, selectedEnvironmentPath);
	}

	async list(): Promise<Environment[]> {
		const config = await readMarsConfig(this.vfs);
		const selectedEnvironmentPath = await this.stateService.getSelectedEnvironmentPath();
		const directoryNames = await this.vfs.listDirectory(config.envs_path);
		const environments: Environment[] = [];

		for (const directoryName of directoryNames) {
			const directoryPath = path.posix.join(normalizePath(config.envs_path), normalizePath(directoryName));

			if (!(await this.vfs.directoryExists(directoryPath))) {
				continue;
			}

			const configPath = path.posix.join(directoryPath, ENVIRONMENT_FILE);
			const environment = await this.readEnvironment(configPath, selectedEnvironmentPath);

			if (environment === null) {
				continue;
			}

			environments.push(environment);
		}

		return environments.sort((left, right) => left.id.localeCompare(right.id));
	}

	async select(name: string): Promise<Environment | null> {
		const environment = await this.get(name);

		if (environment === null) {
			return null;
		}

		await this.stateService.setSelectedEnvironmentPath(environment.configPath);

		return {
			...environment,
			selected: true,
		};
	}

	async readEnvironment(configPath: string, selectedEnvironmentPath: string | null): Promise<Environment | null> {
		if (!(await this.vfs.fileExists(configPath))) {
			return null;
		}

		const environmentContents = await this.vfs.readTextFile(configPath);
		const environmentFields = parse(environmentContents) as unknown;
		const config = new EnvironmentConfig(environmentFields);
		const normalizedConfigPath = normalizePath(configPath);
		const directoryPath = path.posix.dirname(normalizedConfigPath);

		return {
			config,
			configPath: normalizedConfigPath,
			directoryPath,
			id: config.id,
			selected: normalizedConfigPath === selectedEnvironmentPath,
		};
	}

	private async createBucket(bucket: string): Promise<void> {
		await this.s3Client.send(
			new CreateBucketCommand({
				Bucket: bucket,
			}),
		);
	}

	private async enableBucketEncryption(bucket: string): Promise<void> {
		await this.s3Client.send(
			new PutBucketEncryptionCommand({
				Bucket: bucket,
				ServerSideEncryptionConfiguration: {
					Rules: [
						{
							ApplyServerSideEncryptionByDefault: {
								SSEAlgorithm: 'AES256',
							},
						},
					],
				},
			}),
		);
	}

	private async enableBucketPublicAccessBlock(bucket: string): Promise<void> {
		await this.s3Client.send(
			new PutPublicAccessBlockCommand({
				Bucket: bucket,
				PublicAccessBlockConfiguration: {
					BlockPublicAcls: true,
					BlockPublicPolicy: true,
					IgnorePublicAcls: true,
					RestrictPublicBuckets: true,
				},
			}),
		);
	}

	private async enableBucketTlsEnforcement(bucket: string): Promise<void> {
		await this.s3Client.send(
			new PutBucketPolicyCommand({
				Bucket: bucket,
				Policy: JSON.stringify({
					Statement: [
						{
							Action: 's3:*',
							Condition: {
								Bool: {
									'aws:SecureTransport': 'false',
								},
							},
							Effect: 'Deny',
							Principal: '*',
							Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`],
							Sid: 'DenyInsecureTransport',
						},
					],
					Version: '2012-10-17',
				}),
			}),
		);
	}

	private async bucketExists(bucket: string): Promise<boolean> {
		try {
			await this.s3Client.send(
				new HeadBucketCommand({
					Bucket: bucket,
				}),
			);

			return true;
		} catch (error) {
			if (!isMissingBucketError(error)) {
				throw error;
			}

			return false;
		}
	}

	private renderBootstrapBucketName(environment: Environment, config: MarsConfig): string {
		return config.env_bucket
			.replaceAll('{namespace}', config.namespace)
			.replaceAll('{env_name}', environment.config.name)
			.replaceAll('{env}', environment.id)
			.replaceAll('{aws_account_id}', environment.config.aws_account_id)
			.replaceAll('{aws_region}', environment.config.aws_region);
	}

	private async resolveForBootstrap(name: string | null): Promise<Environment | null> {
		if (name !== null) {
			return this.get(name);
		}

		return this.getCurrent();
	}
}
