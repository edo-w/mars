import type { BackendFactory } from '#src/app/backend/backend-factory';
import type { ConfigService } from '#src/app/config/config-service';
import type { Environment } from '#src/app/environment/environment-shapes';
import type { LockService } from '#src/app/lock/lock-service';
import { NodeRepo } from '#src/app/node/node-repo';
import {
	createNodeDirectoryWorkPath,
	createNodeStoreBackendPath,
	createNodeStoreWorkPath,
	type NodeStoreSaveResult,
} from '#src/app/node/node-shapes';
import { DbClient } from '#src/lib/db';
import type { Vfs } from '#src/lib/vfs';

export class NodeSyncService {
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
		const nodeDirectoryPath = createNodeDirectoryWorkPath(config.work_path, environment.id);

		await this.vfs.removeDirectory(nodeDirectoryPath);
	}

	async ensureLocalState(environment: Environment): Promise<void> {
		const config = await this.configService.get();
		const localStorePath = createNodeStoreWorkPath(config.work_path, environment.id);

		if (await this.vfs.fileExists(localStorePath)) {
			return;
		}

		await this.pull(environment);
	}

	async pull(environment: Environment): Promise<void> {
		const backendService = await this.backendFactory.create();
		const config = await this.configService.get();
		const localStorePath = createNodeStoreWorkPath(config.work_path, environment.id);
		const nodeDirectoryPath = createNodeDirectoryWorkPath(config.work_path, environment.id);
		const backendStorePath = createNodeStoreBackendPath(environment.id);

		if (await this.vfs.fileExists(localStorePath)) {
			return;
		}

		await this.vfs.removeDirectory(nodeDirectoryPath);

		if (!(await backendService.fileExists(environment, backendStorePath))) {
			return;
		}

		const storeBytes = await backendService.readFile(environment, backendStorePath);

		await this.vfs.ensureDirectory(nodeDirectoryPath);
		await this.vfs.writeFile(localStorePath, storeBytes);
	}

	async save(environment: Environment): Promise<NodeStoreSaveResult> {
		const config = await this.configService.get();
		const localStorePath = createNodeStoreWorkPath(config.work_path, environment.id);

		if (!(await this.vfs.fileExists(localStorePath))) {
			return {
				node_count: 0,
			};
		}

		const db = new DbClient(this.vfs.resolve(localStorePath));
		const repo = NodeRepo.open(db);
		const acquireLockResult = await this.lockService.acquire(environment, 'node');

		if (acquireLockResult.kind === 'fail') {
			throw new Error(acquireLockResult.error);
		}

		try {
			const backendService = await this.backendFactory.create();
			const nodeCount = repo.list([]).length;

			repo.checkpoint();

			const storeBytes = await this.vfs.readFile(localStorePath);

			await backendService.writeFile(environment, createNodeStoreBackendPath(environment.id), storeBytes);

			return {
				node_count: nodeCount,
			};
		} finally {
			repo.close();
			await this.lockService.release(environment, 'node');
		}
	}
}
