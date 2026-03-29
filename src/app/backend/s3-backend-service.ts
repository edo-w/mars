import path from 'node:path';
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	type S3Client,
} from '@aws-sdk/client-s3';
import type { BackendService } from '#src/app/backend/backend-service';
import { type BackendInfo, renderS3BucketName } from '#src/app/backend/backend-shapes';
import type { ConfigService } from '#src/app/config/config-service';
import { isS3BackendConfig } from '#src/app/config/config-shapes';
import type { Environment } from '#src/app/environment/environment-shapes';
import { isMissingObjectError, readS3BodyBytes } from '#src/lib/s3';
import type { Vfs } from '#src/lib/vfs';

export class S3BackendService implements BackendService {
	configService: ConfigService;
	s3Client: S3Client;
	vfs: Vfs;

	constructor(vfs: Vfs, configService: ConfigService, s3Client: S3Client) {
		this.configService = configService;
		this.s3Client = s3Client;
		this.vfs = vfs;
	}

	async fileExists(environment: Environment, targetPath: string): Promise<boolean> {
		const objectHead = await this.readObjectHead(environment, targetPath);

		return objectHead !== null;
	}

	async getFilePath(environment: Environment, targetPath: string): Promise<string> {
		const bucket = await this.getBucket(environment);
		const objectKey = this.resolveObjectKey(targetPath);

		return `s3://${bucket}/${objectKey}`;
	}

	async readFile(environment: Environment, targetPath: string): Promise<Uint8Array> {
		const bucket = await this.getBucket(environment);
		const result = await this.s3Client.send(
			new GetObjectCommand({
				Bucket: bucket,
				Key: this.resolveObjectKey(targetPath),
			}),
		);

		if (result.Body === undefined) {
			throw new Error(`Missing body for backend object "${targetPath}"`);
		}

		return readS3BodyBytes(result.Body);
	}

	async getInfo(environment: Environment): Promise<BackendInfo> {
		const bucket = await this.getBucket(environment);

		return {
			fields: [
				{
					name: 'env_bucket',
					value: bucket,
				},
			],
			type: 's3',
		};
	}

	async getLastModifiedDate(environment: Environment, targetPath: string): Promise<Date | null> {
		const objectHead = await this.readObjectHead(environment, targetPath);

		return objectHead?.LastModified ?? null;
	}

	async listDirectory(environment: Environment, targetPath: string): Promise<string[]> {
		const bucket = await this.getBucket(environment);
		const prefix = `${this.resolveObjectKey(targetPath)}/`;
		const result = await this.s3Client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Delimiter: '/',
				Prefix: prefix,
			}),
		);
		const entryNames = new Set<string>();
		let objectNames: string[] = [];
		let directoryNames: string[] = [];

		if (result.Contents !== undefined) {
			objectNames = result.Contents.flatMap((object) => {
				const key = object.Key;

				if (key === undefined) {
					return [];
				}

				const keyIsPrefix = key === prefix;
				const keyIsInPrefix = key.startsWith(prefix);
				const shouldInclude = !keyIsPrefix && keyIsInPrefix;

				if (!shouldInclude) {
					return [];
				}

				const entryName = path.posix.basename(key);
				const entryNameIsEmpty = entryName.length === 0;

				return entryNameIsEmpty ? [] : [entryName];
			});
		}

		if (result.CommonPrefixes !== undefined) {
			directoryNames = result.CommonPrefixes.flatMap((directory) => {
				const directoryPrefix = directory.Prefix;

				if (directoryPrefix === undefined) {
					return [];
				}

				const prefixIsInPath = directoryPrefix.startsWith(prefix);

				if (!prefixIsInPath) {
					return [];
				}

				const directoryHasTrailingSlash = directoryPrefix.endsWith('/');
				const normalizedPrefix = directoryHasTrailingSlash ? directoryPrefix.slice(0, -1) : directoryPrefix;
				const entryName = path.posix.basename(normalizedPrefix);
				const entryNameIsEmpty = entryName.length === 0;

				return entryNameIsEmpty ? [] : [entryName];
			});
		}

		for (const entryName of [...objectNames, ...directoryNames]) {
			entryNames.add(entryName);
		}

		return [...entryNames].sort((left, right) => left.localeCompare(right));
	}

	async readTextFile(environment: Environment, targetPath: string): Promise<string> {
		const fileBytes = await this.readFile(environment, targetPath);

		return new TextDecoder().decode(fileBytes);
	}

	async removeFile(environment: Environment, targetPath: string): Promise<void> {
		const bucket = await this.getBucket(environment);

		await this.s3Client.send(
			new DeleteObjectCommand({
				Bucket: bucket,
				Key: this.resolveObjectKey(targetPath),
			}),
		);
	}

	async writeTextFile(environment: Environment, targetPath: string, contents: string): Promise<void> {
		await this.writeFile(environment, targetPath, new TextEncoder().encode(contents));
	}

	async writeFile(environment: Environment, targetPath: string, contents: Uint8Array): Promise<void> {
		const bucket = await this.getBucket(environment);

		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Body: contents,
				Key: this.resolveObjectKey(targetPath),
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

	private async readObjectHead(
		environment: Environment,
		targetPath: string,
	): Promise<{ LastModified?: Date } | null> {
		const bucket = await this.getBucket(environment);

		try {
			return await this.s3Client.send(
				new HeadObjectCommand({
					Bucket: bucket,
					Key: this.resolveObjectKey(targetPath),
				}),
			);
		} catch (error) {
			if (!isMissingObjectError(error)) {
				throw error;
			}

			return null;
		}
	}

	private resolveObjectKey(targetPath: string): string {
		return path.posix.join('mars', targetPath);
	}
}
