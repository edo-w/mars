import type { BackendFactory } from '#src/app/backend/backend-factory';
import type { ConfigService } from '#src/app/config/config-service';
import type { Environment } from '#src/app/environment/environment-shapes';
import { KvPendingBlobOperation } from '#src/app/kv/kv-models';
import { KvRepo } from '#src/app/kv/kv-repo';
import {
	createKvBlobBackendPath,
	createKvBlobWorkPath,
	createKvDirectoryWorkPath,
	createKvStoreBackendPath,
	createKvStoreWorkPath,
	getKvBlobId,
	type KvStateSaveResult,
} from '#src/app/kv/kv-shapes';
import type { LockService } from '#src/app/lock/lock-service';
import { DbClient } from '#src/lib/db';
import type { Vfs } from '#src/lib/vfs';

export class KvSyncService {
	backendFactory: BackendFactory;
	configService: ConfigService;
	lockService: LockService;
	vfs: Vfs;

	constructor(vfs: Vfs, configService: ConfigService, backendFactory: BackendFactory, lockService: LockService) {
		this.backendFactory = backendFactory;
		this.configService = configService;
		this.lockService = lockService;
		this.vfs = vfs;
	}

	async clear(environment: Environment): Promise<void> {
		const config = await this.configService.get();
		const kvDirectoryPath = createKvDirectoryWorkPath(config.work_path, environment.id);

		await this.vfs.removeDirectory(kvDirectoryPath);
	}

	async ensureLocalState(environment: Environment): Promise<void> {
		const config = await this.configService.get();
		const localStorePath = createKvStoreWorkPath(config.work_path, environment.id);

		if (await this.vfs.fileExists(localStorePath)) {
			return;
		}

		await this.pull(environment);
	}

	async pull(environment: Environment): Promise<void> {
		const backendService = await this.backendFactory.create();
		const config = await this.configService.get();
		const kvDirectoryPath = createKvDirectoryWorkPath(config.work_path, environment.id);
		const localStorePath = createKvStoreWorkPath(config.work_path, environment.id);
		const backendStorePath = createKvStoreBackendPath(environment.id);

		if (await this.vfs.fileExists(localStorePath)) {
			return;
		}

		await this.vfs.removeDirectory(kvDirectoryPath);

		if (!(await backendService.fileExists(environment, backendStorePath))) {
			return;
		}

		const storeBytes = await backendService.readFile(environment, backendStorePath);

		await this.vfs.ensureDirectory(kvDirectoryPath);
		await this.vfs.writeFile(localStorePath, storeBytes);
	}

	async pullBlob(environment: Environment, blobId: string): Promise<void> {
		const backendService = await this.backendFactory.create();
		const config = await this.configService.get();
		const localPath = createKvBlobBackendPath(environment.id, blobId);
		const blobBytes = await backendService.readFile(environment, localPath);

		await this.vfs.writeFile(createKvBlobWorkPath(config.work_path, environment.id, blobId), blobBytes);
	}

	async save(environment: Environment): Promise<KvStateSaveResult> {
		const config = await this.configService.get();
		const localStorePath = createKvStoreWorkPath(config.work_path, environment.id);

		if (!(await this.vfs.fileExists(localStorePath))) {
			return {
				deleted_blob_count: 0,
				uploaded_blob_count: 0,
			};
		}

		const db = new DbClient(this.vfs.resolve(localStorePath));
		const repo = KvRepo.open(db);
		const acquireLockResult = await this.lockService.acquire(environment, 'kv');
		let deletedBlobCount = 0;
		let uploadedBlobCount = 0;

		if (acquireLockResult.kind === 'fail') {
			throw new Error(acquireLockResult.error);
		}

		try {
			const backendService = await this.backendFactory.create();
			const pendingBlobs = repo.listPendingBlobs();
			const uploads = pendingBlobs.filter((entry) => entry.operation === KvPendingBlobOperation.Upload);
			const deletes = pendingBlobs.filter((entry) => entry.operation === KvPendingBlobOperation.Delete);

			repo.checkpoint();

			for (const upload of uploads) {
				const blobId = getKvBlobId(upload.local_path);
				const blobBytes = await this.vfs.readFile(upload.local_path);

				await backendService.writeFile(environment, createKvBlobBackendPath(environment.id, blobId), blobBytes);
				repo.removePendingBlob(upload);
				uploadedBlobCount += 1;
			}

			for (const remove of deletes) {
				const blobId = getKvBlobId(remove.local_path);

				await backendService.removeFile(environment, createKvBlobBackendPath(environment.id, blobId));
				repo.removePendingBlob(remove);
				deletedBlobCount += 1;
			}

			repo.checkpoint();

			const storeBytes = await this.vfs.readFile(localStorePath);

			await backendService.writeFile(environment, createKvStoreBackendPath(environment.id), storeBytes);
		} finally {
			repo.close();
			await this.lockService.release(environment, 'kv');
		}

		return {
			deleted_blob_count: deletedBlobCount,
			uploaded_blob_count: uploadedBlobCount,
		};
	}
}
