import path from 'node:path';
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	type S3Client,
} from '@aws-sdk/client-s3';
import type { EnvironmentService } from '#src/cli/app/environment/environment-service';
import type { Environment } from '#src/cli/app/environment/environment-shapes';
import type {
	CreateSshCaResult,
	DestroySshCaResult,
	PullSshCaResult,
	SshCa,
	SshCaResource,
} from '#src/cli/app/ssh-ca/ssh-ca-shapes';
import {
	createSshCaPrivateKeyLocalPath,
	createSshCaPrivateKeyS3Path,
	createSshCaPublicKeyLocalPath,
	createSshCaPublicKeyS3Path,
	SSH_CA_PRIVATE_KEY_SUFFIX,
	SSH_CA_PUBLIC_KEY_SUFFIX,
	SSH_CA_S3_DIRECTORY,
} from '#src/cli/app/ssh-ca/ssh-ca-shapes';
import { readMarsConfig } from '#src/cli/boot/config';
import { isMissingObjectError } from '#src/lib/s3';
import type { SshKeygen } from '#src/lib/ssh';
import type { Vfs } from '#src/lib/vfs';

export class SshCaService {
	environmentService: EnvironmentService;
	s3Client: S3Client;
	sshKeygen: SshKeygen;
	vfs: Vfs;

	constructor(vfs: Vfs, environmentService: EnvironmentService, s3Client: S3Client, sshKeygen: SshKeygen) {
		this.environmentService = environmentService;
		this.s3Client = s3Client;
		this.sshKeygen = sshKeygen;
		this.vfs = vfs;
	}

	async list(environment: Environment): Promise<string[]> {
		const bucket = await this.environmentService.getBucketName(environment);
		const objectKeys = await this.listObjectKeys(bucket, SSH_CA_S3_DIRECTORY);
		const names = new Set<string>();

		for (const objectKey of objectKeys) {
			const name = this.parseSshCaName(objectKey);

			if (name !== null) {
				names.add(name);
			}
		}

		return [...names].sort((left, right) => left.localeCompare(right));
	}

	async show(environment: Environment, name: string): Promise<SshCa | null> {
		const bucket = await this.environmentService.getBucketName(environment);
		const privateKeyPath = createSshCaPrivateKeyS3Path(name);
		const publicKeyPath = createSshCaPublicKeyS3Path(name);
		const privateKeyHead = await this.readObjectHead(bucket, privateKeyPath);
		const publicKeyHead = await this.readObjectHead(bucket, publicKeyPath);

		if (privateKeyHead === null || publicKeyHead === null) {
			return null;
		}

		return {
			create_date: privateKeyHead.LastModified ?? new Date(0),
			name,
			private_key: `s3://${bucket}/${privateKeyPath}`,
			public_key: `s3://${bucket}/${publicKeyPath}`,
		};
	}

	async create(environment: Environment, name: string, passphrase: string): Promise<CreateSshCaResult> {
		const localPaths = await this.getLocalPaths(name);

		if (
			(await this.vfs.fileExists(localPaths.privateKeyPath)) ||
			(await this.vfs.fileExists(localPaths.publicKeyPath))
		) {
			return {
				kind: 'already_exists',
				name,
			};
		}

		const bucket = await this.environmentService.getBucketName(environment);
		const s3Paths = this.getS3Paths(name);

		if (
			(await this.objectExists(bucket, s3Paths.privateKeyPath)) ||
			(await this.objectExists(bucket, s3Paths.publicKeyPath))
		) {
			return {
				kind: 'already_exists',
				name,
			};
		}

		const localDirectoryPath = path.posix.dirname(localPaths.privateKeyPath);
		const generatedPaths = this.getGeneratedLocalPaths(localPaths.privateKeyPath);
		const generatedPrivateKeyPath = this.vfs.resolve(generatedPaths.privateKeyPath);
		const comment = `mars ${name} ssh ca`;

		await this.vfs.ensureDirectory(localDirectoryPath);
		await this.sshKeygen.generateKeyPair({
			comment,
			passphrase,
			privateKeyPath: generatedPrivateKeyPath,
		});

		const privateKeyContents = await this.vfs.readTextFile(generatedPaths.privateKeyPath);
		const publicKeyContents = await this.vfs.readTextFile(generatedPaths.publicKeyPath);

		if (generatedPaths.privateKeyPath !== localPaths.privateKeyPath) {
			await this.vfs.writeTextFile(localPaths.privateKeyPath, privateKeyContents);
			await this.vfs.removeFile(generatedPaths.privateKeyPath);
		}

		if (generatedPaths.publicKeyPath !== localPaths.publicKeyPath) {
			await this.vfs.writeTextFile(localPaths.publicKeyPath, publicKeyContents);
			await this.vfs.removeFile(generatedPaths.publicKeyPath);
		}

		await this.putObject(bucket, s3Paths.privateKeyPath, privateKeyContents);
		await this.putObject(bucket, s3Paths.publicKeyPath, publicKeyContents);

		const sshCa = await this.show(environment, name);

		if (sshCa === null) {
			throw new Error(`Failed to load created ssh ca "${name}"`);
		}

		return {
			kind: 'created',
			ssh_ca: sshCa,
		};
	}

	async pull(environment: Environment, name: string): Promise<PullSshCaResult> {
		const bucket = await this.environmentService.getBucketName(environment);
		const s3Paths = this.getS3Paths(name);
		const privateKeyHead = await this.readObjectHead(bucket, s3Paths.privateKeyPath);
		const publicKeyHead = await this.readObjectHead(bucket, s3Paths.publicKeyPath);
		const missingFiles: string[] = [];

		if (privateKeyHead === null) {
			missingFiles.push(s3Paths.privateKeyPath);
		}

		if (publicKeyHead === null) {
			missingFiles.push(s3Paths.publicKeyPath);
		}

		if (missingFiles.length === 2) {
			return {
				kind: 'not_found',
				name,
			};
		}

		if (missingFiles.length > 0) {
			return {
				kind: 'corrupted',
				missing_files: missingFiles,
				name,
			};
		}

		const localPaths = await this.getLocalPaths(name);
		const localDirectoryPath = path.posix.dirname(localPaths.privateKeyPath);
		const createDate = privateKeyHead?.LastModified ?? new Date(0);
		const privateKeyContents = await this.getObjectText(bucket, s3Paths.privateKeyPath);
		const publicKeyContents = await this.getObjectText(bucket, s3Paths.publicKeyPath);

		await this.vfs.ensureDirectory(localDirectoryPath);
		await this.vfs.writeTextFile(localPaths.privateKeyPath, privateKeyContents);
		await this.vfs.writeTextFile(localPaths.publicKeyPath, publicKeyContents);

		return {
			kind: 'pulled',
			ssh_ca: {
				create_date: createDate,
				name,
				private_key: `s3://${bucket}/${s3Paths.privateKeyPath}`,
				public_key: `s3://${bucket}/${s3Paths.publicKeyPath}`,
			},
		};
	}

	async rm(name: string): Promise<boolean> {
		const localPaths = await this.getLocalPaths(name);
		const privateKeyExists = await this.vfs.fileExists(localPaths.privateKeyPath);
		const publicKeyExists = await this.vfs.fileExists(localPaths.publicKeyPath);

		if (!privateKeyExists && !publicKeyExists) {
			return false;
		}

		await this.vfs.removeFile(localPaths.privateKeyPath);
		await this.vfs.removeFile(localPaths.publicKeyPath);

		return true;
	}

	async describeDestroy(environment: Environment, name: string): Promise<SshCaResource[] | null> {
		const bucket = await this.environmentService.getBucketName(environment);
		const s3Paths = this.getS3Paths(name);
		const localPaths = await this.getLocalPaths(name);
		const resources: SshCaResource[] = [];

		if (await this.objectExists(bucket, s3Paths.privateKeyPath)) {
			resources.push({
				label: `s3 object "${s3Paths.privateKeyPath}"`,
			});
		}

		if (await this.objectExists(bucket, s3Paths.publicKeyPath)) {
			resources.push({
				label: `s3 object "${s3Paths.publicKeyPath}"`,
			});
		}

		if (await this.vfs.fileExists(localPaths.privateKeyPath)) {
			resources.push({
				label: `local file "${localPaths.privateKeyPath}"`,
			});
		}

		if (await this.vfs.fileExists(localPaths.publicKeyPath)) {
			resources.push({
				label: `local file "${localPaths.publicKeyPath}"`,
			});
		}

		return resources.length === 0 ? null : resources;
	}

	async destroy(environment: Environment, name: string): Promise<DestroySshCaResult> {
		const bucket = await this.environmentService.getBucketName(environment);
		const s3Paths = this.getS3Paths(name);
		const localPaths = await this.getLocalPaths(name);
		const resources = await this.describeDestroy(environment, name);

		if (resources === null) {
			return {
				kind: 'not_found',
				name,
			};
		}

		if (await this.objectExists(bucket, s3Paths.privateKeyPath)) {
			await this.deleteObject(bucket, s3Paths.privateKeyPath);
		}

		if (await this.objectExists(bucket, s3Paths.publicKeyPath)) {
			await this.deleteObject(bucket, s3Paths.publicKeyPath);
		}

		if (await this.vfs.fileExists(localPaths.privateKeyPath)) {
			await this.vfs.removeFile(localPaths.privateKeyPath);
		}

		if (await this.vfs.fileExists(localPaths.publicKeyPath)) {
			await this.vfs.removeFile(localPaths.publicKeyPath);
		}

		return {
			kind: 'destroyed',
			resources,
		};
	}

	private async deleteObject(bucket: string, objectKey: string): Promise<void> {
		await this.s3Client.send(
			new DeleteObjectCommand({
				Bucket: bucket,
				Key: objectKey,
			}),
		);
	}

	private async getObjectText(bucket: string, objectKey: string): Promise<string> {
		const result = await this.s3Client.send(
			new GetObjectCommand({
				Bucket: bucket,
				Key: objectKey,
			}),
		);

		if (result.Body === undefined) {
			throw new Error(`Missing body for s3 object "${objectKey}"`);
		}

		return result.Body.transformToString();
	}

	private getS3Paths(name: string): { privateKeyPath: string; publicKeyPath: string } {
		return {
			privateKeyPath: createSshCaPrivateKeyS3Path(name),
			publicKeyPath: createSshCaPublicKeyS3Path(name),
		};
	}

	private async getLocalPaths(name: string): Promise<{ privateKeyPath: string; publicKeyPath: string }> {
		const config = await readMarsConfig(this.vfs);

		return {
			privateKeyPath: createSshCaPrivateKeyLocalPath(config.work_path, name),
			publicKeyPath: createSshCaPublicKeyLocalPath(config.work_path, name),
		};
	}

	private getGeneratedLocalPaths(privateKeyPath: string): {
		privateKeyPath: string;
		publicKeyPath: string;
	} {
		const generatedPrivateKeyPath = privateKeyPath.replace(/\.key$/, '');

		return {
			privateKeyPath: generatedPrivateKeyPath,
			publicKeyPath: `${generatedPrivateKeyPath}.pub`,
		};
	}

	private async listObjectKeys(bucket: string, prefix: string): Promise<string[]> {
		const objectKeys: string[] = [];
		let continuationToken: string | undefined;

		do {
			const result = await this.s3Client.send(
				new ListObjectsV2Command({
					Bucket: bucket,
					ContinuationToken: continuationToken,
					Prefix: `${prefix}/`,
				}),
			);
			const pageObjectKeys =
				result.Contents?.flatMap((object) => {
					return object.Key === undefined ? [] : [object.Key];
				}) ?? [];

			objectKeys.push(...pageObjectKeys);
			continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
		} while (continuationToken !== undefined);

		return objectKeys;
	}

	private async objectExists(bucket: string, objectKey: string): Promise<boolean> {
		const objectHead = await this.readObjectHead(bucket, objectKey);

		return objectHead !== null;
	}

	private parseSshCaName(objectKey: string): string | null {
		const objectName = path.posix.basename(objectKey);

		if (objectName.endsWith(SSH_CA_PRIVATE_KEY_SUFFIX)) {
			return objectName.slice(0, -SSH_CA_PRIVATE_KEY_SUFFIX.length);
		}

		if (objectName.endsWith(SSH_CA_PUBLIC_KEY_SUFFIX)) {
			return objectName.slice(0, -SSH_CA_PUBLIC_KEY_SUFFIX.length);
		}

		return null;
	}

	private async putObject(bucket: string, objectKey: string, body: string): Promise<void> {
		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: bucket,
				Body: body,
				Key: objectKey,
			}),
		);
	}

	private async readObjectHead(bucket: string, objectKey: string): Promise<{ LastModified?: Date } | null> {
		try {
			return await this.s3Client.send(
				new HeadObjectCommand({
					Bucket: bucket,
					Key: objectKey,
				}),
			);
		} catch (error) {
			if (!isMissingObjectError(error)) {
				throw error;
			}

			return null;
		}
	}
}
