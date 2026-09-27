import path from 'node:path';
import type { BackendFactory } from '#src/app/backend/backend-factory';
import type { ConfigService } from '#src/app/config/config-service';
import type { Environment } from '#src/app/environment/environment-shapes';
import type { KeyAgentManager } from '#src/app/key-agent/key-agent-manager';
import type { PlaybookSshIdentity } from '#src/app/playbook/playbook-models';
import type { SecretsService } from '#src/app/secrets/secrets-service';
import { EncryptedSecretRecord } from '#src/app/secrets/secrets-shapes';
import type {
	CreateSshCaResult,
	DestroySshCaResult,
	PullSshCaResult,
	SshCa,
	SshCaResource,
} from '#src/app/ssh-ca/ssh-ca-shapes';
import {
	createSshCaDirectoryBackendPath,
	createSshCaPasswordBackendPath,
	createSshCaPrivateKeyBackendPath,
	createSshCaPrivateKeyWorkPath,
	createSshCaPublicKeyBackendPath,
	createSshCaPublicKeyWorkPath,
	SSH_CA_PASSWORD_SUFFIX,
	SSH_CA_PRIVATE_KEY_SUFFIX,
	SSH_CA_PUBLIC_KEY_SUFFIX,
} from '#src/app/ssh-ca/ssh-ca-shapes';
import type { SshKeygen } from '#src/lib/ssh';
import type { Vfs } from '#src/lib/vfs';

export class SshCaService {
	backendFactory: BackendFactory;
	configService: ConfigService;
	keyAgentManager: KeyAgentManager;
	secretsService: SecretsService;
	sshKeygen: SshKeygen;
	vfs: Vfs;

	constructor(
		vfs: Vfs,
		configService: ConfigService,
		backendFactory: BackendFactory,
		keyAgentManager: KeyAgentManager,
		secretsService: SecretsService,
		sshKeygen: SshKeygen,
	) {
		this.backendFactory = backendFactory;
		this.configService = configService;
		this.keyAgentManager = keyAgentManager;
		this.secretsService = secretsService;
		this.sshKeygen = sshKeygen;
		this.vfs = vfs;
	}

	async list(environment: Environment): Promise<string[]> {
		const backendService = await this.backendFactory.create();
		const fileNames = await backendService.listDirectory(
			environment,
			createSshCaDirectoryBackendPath(environment.id),
		);
		const names = new Set<string>();

		for (const fileName of fileNames) {
			const name = this.parseSshCaName(fileName);

			if (name !== null) {
				names.add(name);
			}
		}

		return [...names].sort((left, right) => left.localeCompare(right));
	}

	async show(environment: Environment, name: string): Promise<SshCa | null> {
		const backendService = await this.backendFactory.create();
		const privateKeyPath = createSshCaPrivateKeyBackendPath(environment.id, name);
		const passwordPath = createSshCaPasswordBackendPath(environment.id, name);
		const publicKeyPath = createSshCaPublicKeyBackendPath(environment.id, name);
		const privateKeyExists = await backendService.fileExists(environment, privateKeyPath);
		const passwordExists = await backendService.fileExists(environment, passwordPath);
		const publicKeyExists = await backendService.fileExists(environment, publicKeyPath);

		if (!privateKeyExists || !publicKeyExists || !passwordExists) {
			return null;
		}

		const createDate = await backendService.getLastModifiedDate(environment, privateKeyPath);

		return {
			create_date: createDate ?? new Date(0),
			name,
			private_key: await backendService.getFilePath(environment, privateKeyPath),
			public_key: await backendService.getFilePath(environment, publicKeyPath),
		};
	}

	async create(environment: Environment, name: string): Promise<CreateSshCaResult> {
		const backendService = await this.backendFactory.create();
		const localPaths = await this.getLocalPaths(environment.id, name);
		const password = this.generatePassword();
		const encryptedPassword = await this.secretsService.encryptBytes(
			environment,
			new TextEncoder().encode(password),
		);
		const passwordContents = JSON.stringify(encryptedPassword);
		const privateKeyPath = createSshCaPrivateKeyBackendPath(environment.id, name);
		const publicKeyPath = createSshCaPublicKeyBackendPath(environment.id, name);
		const passwordPath = createSshCaPasswordBackendPath(environment.id, name);

		if (
			(await this.vfs.fileExists(localPaths.privateKeyPath)) ||
			(await this.vfs.fileExists(localPaths.publicKeyPath))
		) {
			return {
				kind: 'already_exists',
				name,
			};
		}

		if (
			(await backendService.fileExists(environment, privateKeyPath)) ||
			(await backendService.fileExists(environment, publicKeyPath)) ||
			(await backendService.fileExists(environment, passwordPath))
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
			passphrase: password,
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

		await backendService.writeTextFile(environment, privateKeyPath, privateKeyContents);
		await backendService.writeTextFile(environment, publicKeyPath, publicKeyContents);
		await backendService.writeTextFile(environment, passwordPath, passwordContents);

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
		const backendService = await this.backendFactory.create();
		const privateKeyPath = createSshCaPrivateKeyBackendPath(environment.id, name);
		const passwordPath = createSshCaPasswordBackendPath(environment.id, name);
		const publicKeyPath = createSshCaPublicKeyBackendPath(environment.id, name);
		const missingFiles: string[] = [];
		const privateKeyExists = await backendService.fileExists(environment, privateKeyPath);
		const passwordExists = await backendService.fileExists(environment, passwordPath);
		const publicKeyExists = await backendService.fileExists(environment, publicKeyPath);

		if (!privateKeyExists) {
			missingFiles.push(privateKeyPath);
		}

		if (!passwordExists) {
			missingFiles.push(passwordPath);
		}

		if (!publicKeyExists) {
			missingFiles.push(publicKeyPath);
		}

		if (missingFiles.length === 3) {
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

		const createDate = await backendService.getLastModifiedDate(environment, privateKeyPath);
		const localPaths = await this.getLocalPaths(environment.id, name);
		const localDirectoryPath = path.posix.dirname(localPaths.privateKeyPath);
		const privateKeyContents = await backendService.readTextFile(environment, privateKeyPath);
		const publicKeyContents = await backendService.readTextFile(environment, publicKeyPath);

		await this.vfs.ensureDirectory(localDirectoryPath);
		await this.vfs.writeTextFile(localPaths.privateKeyPath, privateKeyContents);
		await this.vfs.writeTextFile(localPaths.publicKeyPath, publicKeyContents);

		return {
			kind: 'pulled',
			ssh_ca: {
				create_date: createDate ?? new Date(0),
				name,
				private_key: await backendService.getFilePath(environment, privateKeyPath),
				public_key: await backendService.getFilePath(environment, publicKeyPath),
			},
		};
	}

	async issueClientIdentity(
		environment: Environment,
		name: string,
		certificateIdentity: string,
	): Promise<PlaybookSshIdentity> {
		const pullResult = await this.pull(environment, name);

		if (pullResult.kind === 'corrupted') {
			throw new Error(`ssh ca "${name}" is corrupted`);
		}

		if (pullResult.kind === 'not_found') {
			throw new Error(`ssh ca "${name}" not found`);
		}

		const backendService = await this.backendFactory.create();
		const passwordPath = createSshCaPasswordBackendPath(environment.id, name);
		const encryptedPasswordFields = JSON.parse(await backendService.readTextFile(environment, passwordPath));
		const encryptedPassword = new EncryptedSecretRecord(encryptedPasswordFields);
		const password = await this.secretsService.decryptText(environment, encryptedPassword);
		const config = await this.configService.get();
		const runKeyPath = path.posix.join(
			config.work_path,
			'env',
			environment.id,
			'playbook',
			`${crypto.randomUUID()}.key`,
		);
		const runPublicKeyPath = `${runKeyPath}.pub`;
		const runCertificatePath = `${runKeyPath}-cert.pub`;
		const localPaths = await this.getLocalPaths(environment.id, name);
		const askpassToken = await this.keyAgentManager.setAskpass(password);

		await this.sshKeygen.generateKeyPair({
			comment: certificateIdentity,
			passphrase: '',
			privateKeyPath: this.vfs.resolve(runKeyPath),
		});

		try {
			await this.sshKeygen.issueCertificate({
				caPrivateKeyPath: this.vfs.resolve(localPaths.privateKeyPath),
				certificateIdentity,
				askpass_token: askpassToken,
				principals: ['mars'],
				publicKeyPath: this.vfs.resolve(runPublicKeyPath),
				validity: '+5m',
			});

			return {
				certificate: await this.vfs.readTextFile(runCertificatePath),
				private_key: await this.vfs.readTextFile(runKeyPath),
			};
		} finally {
			await this.keyAgentManager.clearAskpass(askpassToken);
			await this.vfs.removeFile(runKeyPath);
			await this.vfs.removeFile(runPublicKeyPath);
			await this.vfs.removeFile(runCertificatePath);
		}
	}

	async remove(environment: Environment, name: string): Promise<boolean> {
		const localPaths = await this.getLocalPaths(environment.id, name);
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
		const backendService = await this.backendFactory.create();
		const privateKeyPath = createSshCaPrivateKeyBackendPath(environment.id, name);
		const passwordPath = createSshCaPasswordBackendPath(environment.id, name);
		const publicKeyPath = createSshCaPublicKeyBackendPath(environment.id, name);
		const localPaths = await this.getLocalPaths(environment.id, name);
		const resources: SshCaResource[] = [];

		if (await backendService.fileExists(environment, privateKeyPath)) {
			resources.push({
				label: `backend file "${await backendService.getFilePath(environment, privateKeyPath)}"`,
			});
		}

		if (await backendService.fileExists(environment, publicKeyPath)) {
			resources.push({
				label: `backend file "${await backendService.getFilePath(environment, publicKeyPath)}"`,
			});
		}

		if (await backendService.fileExists(environment, passwordPath)) {
			resources.push({
				label: `backend file "${await backendService.getFilePath(environment, passwordPath)}"`,
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
		const backendService = await this.backendFactory.create();
		const privateKeyPath = createSshCaPrivateKeyBackendPath(environment.id, name);
		const passwordPath = createSshCaPasswordBackendPath(environment.id, name);
		const publicKeyPath = createSshCaPublicKeyBackendPath(environment.id, name);
		const localPaths = await this.getLocalPaths(environment.id, name);
		const resources = await this.describeDestroy(environment, name);

		if (resources === null) {
			return {
				kind: 'not_found',
				name,
			};
		}

		if (await backendService.fileExists(environment, privateKeyPath)) {
			await backendService.removeFile(environment, privateKeyPath);
		}

		if (await backendService.fileExists(environment, publicKeyPath)) {
			await backendService.removeFile(environment, publicKeyPath);
		}

		if (await backendService.fileExists(environment, passwordPath)) {
			await backendService.removeFile(environment, passwordPath);
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

	private async getLocalPaths(env: string, name: string): Promise<{ privateKeyPath: string; publicKeyPath: string }> {
		const config = await this.configService.get();

		return {
			privateKeyPath: createSshCaPrivateKeyWorkPath(config.work_path, env, name),
			publicKeyPath: createSshCaPublicKeyWorkPath(config.work_path, env, name),
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

	private parseSshCaName(objectKey: string): string | null {
		const objectName = path.posix.basename(objectKey);

		if (objectName.endsWith(SSH_CA_PASSWORD_SUFFIX)) {
			return objectName.slice(0, -SSH_CA_PASSWORD_SUFFIX.length);
		}

		if (objectName.endsWith(SSH_CA_PRIVATE_KEY_SUFFIX)) {
			return objectName.slice(0, -SSH_CA_PRIVATE_KEY_SUFFIX.length);
		}

		if (objectName.endsWith(SSH_CA_PUBLIC_KEY_SUFFIX)) {
			return objectName.slice(0, -SSH_CA_PUBLIC_KEY_SUFFIX.length);
		}

		return null;
	}

	private generatePassword(): string {
		const bytes = crypto.getRandomValues(new Uint8Array(32));

		return Buffer.from(bytes).toString('base64url');
	}
}
