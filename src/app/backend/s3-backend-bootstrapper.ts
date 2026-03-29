import {
	CreateBucketCommand,
	DeleteBucketCommand,
	DeleteObjectsCommand,
	HeadBucketCommand,
	ListObjectsV2Command,
	PutBucketEncryptionCommand,
	PutBucketPolicyCommand,
	PutPublicAccessBlockCommand,
	type S3Client,
} from '@aws-sdk/client-s3';
import type { BackendBootstrapper, BackendBootstrapResult } from '#src/app/backend/backend-bootstrapper';
import { type BackendDestroyResult, createS3BucketResource, renderS3BucketName } from '#src/app/backend/backend-shapes';
import type { ConfigService } from '#src/app/config/config-service';
import { isS3BackendConfig } from '#src/app/config/config-shapes';
import type { Environment, EnvironmentResource } from '#src/app/environment/environment-shapes';
import { isMissingBucketError } from '#src/lib/s3';

export class S3BackendBootstrapper implements BackendBootstrapper {
	configService: ConfigService;
	s3Client: S3Client;

	constructor(configService: ConfigService, s3Client: S3Client) {
		this.configService = configService;
		this.s3Client = s3Client;
	}

	async bootstrap(environment: Environment): Promise<BackendBootstrapResult> {
		const bucket = await this.getBucket(environment);
		const resourceLabel = `s3 bucket "${bucket}"`;

		if (await this.bucketExists(bucket)) {
			return {
				kind: 'already_exists',
				resource_label: resourceLabel,
			};
		}

		await this.createBucket(bucket);
		await this.enableBucketEncryption(bucket);
		await this.enableBucketPublicAccessBlock(bucket);
		await this.enableBucketTlsEnforcement(bucket);

		return {
			kind: 'created',
			resource_label: resourceLabel,
		};
	}

	async describeDestroy(environment: Environment): Promise<EnvironmentResource[]> {
		const bucket = await this.getBucket(environment);

		return [createS3BucketResource(bucket, 'destroy')];
	}

	async destroy(environment: Environment): Promise<BackendDestroyResult> {
		const bucket = await this.getBucket(environment);
		const resources: EnvironmentResource[] = [];

		try {
			if (!(await this.bucketExists(bucket))) {
				resources.push(createS3BucketResource(bucket, 'not_found'));

				return {
					kind: 'success',
					resources,
				};
			}

			await this.emptyBucket(bucket);
			await this.deleteBucket(bucket);
			resources.push(createS3BucketResource(bucket, 'destroy'));

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

	private async createBucket(bucket: string): Promise<void> {
		await this.s3Client.send(
			new CreateBucketCommand({
				Bucket: bucket,
			}),
		);
	}

	private async deleteBucket(bucket: string): Promise<void> {
		await this.s3Client.send(
			new DeleteBucketCommand({
				Bucket: bucket,
			}),
		);
	}

	private async emptyBucket(bucket: string): Promise<void> {
		let continuationToken: string | undefined;

		do {
			const result = await this.s3Client.send(
				new ListObjectsV2Command({
					Bucket: bucket,
					ContinuationToken: continuationToken,
				}),
			);
			const objectKeys =
				result.Contents?.flatMap((object) => {
					const key = object.Key;

					if (key === undefined) {
						return [];
					}

					return [
						{
							Key: key,
						},
					];
				}) ?? [];

			if (objectKeys.length > 0) {
				await this.s3Client.send(
					new DeleteObjectsCommand({
						Bucket: bucket,
						Delete: {
							Objects: objectKeys,
						},
					}),
				);
			}

			continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
		} while (continuationToken !== undefined);
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

	private async getBucket(environment: Environment): Promise<string> {
		const config = await this.configService.get();

		if (!isS3BackendConfig(config.backend)) {
			throw new Error('backend s3 is not configured');
		}

		return renderS3BucketName(environment, config, config.backend.s3.bucket);
	}
}
