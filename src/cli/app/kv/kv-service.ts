import path from 'node:path';
import type { ConfigService } from '#src/cli/app/config/config-service';
import type { Environment } from '#src/cli/app/environment/environment-shapes';
import {
	KvCurrentValueModel,
	KvDataType,
	KvPendingBlobModel,
	KvPendingBlobOperation,
	KvSecretConfigModel,
} from '#src/cli/app/kv/kv-models';
import { KvRepo } from '#src/cli/app/kv/kv-repo';
import {
	createKvBlobWorkPath,
	createKvStoreWorkPath,
	KV_INLINE_VALUE_LIMIT_BYTES,
	type KvGetResult,
	type KvListResultItem,
	type KvSetInput,
	type KvSetResult,
	type KvShowResult,
	type KvStateSaveResult,
	parseKvKeyPath,
	parseKvKeyPrefix,
	parseKvKeyReference,
} from '#src/cli/app/kv/kv-shapes';
import type { KvSyncService } from '#src/cli/app/kv/kv-sync-service';
import type { SecretsService } from '#src/cli/app/secrets/secrets-service';
import { EncryptedSecretRecord, fromBase64, toBase64 } from '#src/cli/app/secrets/secrets-shapes';
import { DbClient } from '#src/lib/db';
import type { Vfs } from '#src/lib/vfs';

export class KvService {
	configService: ConfigService;
	kvSyncService: KvSyncService;
	repos: Map<string, KvRepo>;
	secretsService: SecretsService;
	vfs: Vfs;

	constructor(vfs: Vfs, configService: ConfigService, kvSyncService: KvSyncService, secretsService: SecretsService) {
		this.configService = configService;
		this.kvSyncService = kvSyncService;
		this.repos = new Map();
		this.secretsService = secretsService;
		this.vfs = vfs;
	}

	async close(): Promise<void> {
		for (const repo of this.repos.values()) {
			repo.close();
		}

		this.repos.clear();
	}

	async get(environment: Environment, referenceValue: string): Promise<KvGetResult | null> {
		await this.kvSyncService.ensureLocalState(environment);

		const reference = parseKvKeyReference(referenceValue);
		const repo = await this.openRepo(environment);
		const value =
			reference.version_id === null
				? repo.getCurrentValue(reference.key_path)
				: this.createCurrentValueFromVersion(repo, reference.key_path, reference.version_id);

		if (value === null) {
			return null;
		}

		const data = await this.readValueBytes(environment, value);

		return {
			data,
			key_path: value.key_path,
			secret: value.secret,
			type: value.data_type,
			version_id: value.version_id,
		};
	}

	async list(environment: Environment, prefix: string): Promise<KvListResultItem[]> {
		await this.kvSyncService.ensureLocalState(environment);

		const keyPrefix = parseKvKeyPrefix(prefix);
		const repo = await this.openRepo(environment);
		const items = repo.list(keyPrefix);

		return items.map((item) => {
			return {
				date: item.update_date,
				key: item.key_path,
				secret: item.secret,
				size: item.data_size,
				type: item.data_type,
			};
		});
	}

	async remove(environment: Environment, keyPath: string): Promise<boolean> {
		await this.kvSyncService.ensureLocalState(environment);

		const normalizedKeyPath = parseKvKeyPath(keyPath);
		const repo = await this.openRepo(environment);
		const config = await this.configService.get();
		const currentValue = repo.getCurrentValue(normalizedKeyPath);

		if (currentValue === null) {
			return false;
		}

		const versions = repo.listVersions(normalizedKeyPath);

		for (const version of versions) {
			if (version.data_blob_id === null) {
				continue;
			}

			const localPath = createKvBlobWorkPath(config.work_path, environment.id, version.data_blob_id);

			repo.addPendingBlob(
				new KvPendingBlobModel({
					key_path: normalizedKeyPath,
					local_path: localPath,
					operation: KvPendingBlobOperation.Delete,
				}),
			);
			await this.vfs.removeFile(localPath);
		}

		repo.removeKey(normalizedKeyPath);

		return true;
	}

	async stateClear(environment: Environment): Promise<void> {
		this.closeRepo(environment.id);
		await this.kvSyncService.clear(environment);
	}

	async statePull(environment: Environment): Promise<void> {
		await this.kvSyncService.pull(environment);
	}

	async stateSave(environment: Environment): Promise<KvStateSaveResult> {
		return this.kvSyncService.save(environment);
	}

	async set(environment: Environment, input: KvSetInput): Promise<KvSetResult> {
		await this.kvSyncService.ensureLocalState(environment);

		const keyPath = parseKvKeyPath(input.key_path);
		const repo = await this.openRepo(environment);
		const config = await this.configService.get();
		const createDate = new Date().toISOString();
		const storesExternally = input.type === KvDataType.File || input.data.byteLength > KV_INLINE_VALUE_LIMIT_BYTES;
		let dataBlobId: string | null = null;
		let dataContent: Uint8Array | null = null;
		let secretConfig: KvSecretConfigModel | null = null;
		if (input.secret) {
			const encryptedSecret = await this.secretsService.encryptBytes(environment, input.data);
			const ciphertext = fromBase64(encryptedSecret.ciphertext);

			secretConfig = new KvSecretConfigModel({
				algorithm: encryptedSecret.algorithm,
				iv: encryptedSecret.iv,
			});

			if (storesExternally) {
				dataBlobId = crypto.randomUUID();

				await this.vfs.writeFile(
					createKvBlobWorkPath(config.work_path, environment.id, dataBlobId),
					ciphertext,
				);
			} else {
				dataContent = ciphertext;
			}
		} else if (storesExternally) {
			dataBlobId = crypto.randomUUID();

			await this.vfs.writeFile(createKvBlobWorkPath(config.work_path, environment.id, dataBlobId), input.data);
		} else {
			dataContent = input.data;
		}

		if (dataBlobId !== null) {
			repo.addPendingBlob(
				new KvPendingBlobModel({
					key_path: keyPath,
					local_path: createKvBlobWorkPath(config.work_path, environment.id, dataBlobId),
					operation: KvPendingBlobOperation.Upload,
				}),
			);
		}

		const version = repo.createVersion({
			create_date: createDate,
			data_blob_id: dataBlobId,
			data_content: dataContent,
			data_size: input.data.byteLength,
			data_type: input.type,
			key_path: keyPath,
			secret_config: secretConfig,
		});

		return {
			key_path: keyPath,
			secret: input.secret,
			type: input.type,
			version_id: version.version_id,
		};
	}

	async show(environment: Environment, keyPath: string): Promise<KvShowResult | null> {
		await this.kvSyncService.ensureLocalState(environment);

		const normalizedKeyPath = parseKvKeyPath(keyPath);
		const repo = await this.openRepo(environment);
		const value = repo.getCurrentValue(normalizedKeyPath);

		if (value === null) {
			return null;
		}

		return {
			create_date: value.create_date,
			key_path: value.key_path,
			secret: value.secret,
			size: value.data_size,
			type: value.data_type,
			update_date: value.update_date,
			version_id: value.version_id,
		};
	}

	private closeRepo(environmentId: string): void {
		const repo = this.repos.get(environmentId);

		if (repo === undefined) {
			return;
		}

		repo.close();
		this.repos.delete(environmentId);
	}

	private createCurrentValueFromVersion(
		repo: KvRepo,
		keyPath: string,
		versionId: number,
	): KvCurrentValueModel | null {
		const key = repo.getKey(keyPath);
		const version = repo.getVersion(keyPath, versionId);

		if (key === null || version === null) {
			return null;
		}

		return new KvCurrentValueModel({
			create_date: key.create_date,
			data_blob_id: version.data_blob_id,
			data_content: version.data_content,
			data_size: version.data_size,
			data_type: version.data_type,
			key_path: version.key_path,
			secret: version.secret_config !== null,
			secret_config: version.secret_config,
			update_date: key.update_date,
			version_create_date: version.create_date,
			version_id: version.version_id,
		});
	}

	private async openRepo(environment: Environment): Promise<KvRepo> {
		const currentRepo = this.repos.get(environment.id);

		if (currentRepo !== undefined) {
			return currentRepo;
		}

		const config = await this.configService.get();
		const localStorePath = createKvStoreWorkPath(config.work_path, environment.id);
		const localDirectoryPath = path.dirname(localStorePath);

		await this.vfs.ensureDirectory(localDirectoryPath);

		const db = new DbClient(this.vfs.resolve(localStorePath));
		const repo = KvRepo.open(db);

		this.repos.set(environment.id, repo);

		return repo;
	}

	private async readValueBytes(environment: Environment, value: KvCurrentValueModel): Promise<Uint8Array> {
		let dataBytes = value.data_content;

		if (value.data_blob_id !== null) {
			const config = await this.configService.get();
			const localPath = createKvBlobWorkPath(config.work_path, environment.id, value.data_blob_id);

			if (!(await this.vfs.fileExists(localPath))) {
				await this.kvSyncService.pullBlob(environment, value.data_blob_id);
			}

			dataBytes = await this.vfs.readFile(localPath);
		}

		if (dataBytes === null) {
			throw new Error(`missing kv data for "${value.key_path}"`);
		}

		if (!value.secret || value.secret_config === null) {
			return dataBytes;
		}

		const encryptedSecret = new EncryptedSecretRecord({
			algorithm: value.secret_config.algorithm,
			ciphertext: toBase64(dataBytes),
			iv: value.secret_config.iv,
		});

		return this.secretsService.decryptBytes(environment, encryptedSecret);
	}
}
