import path from 'node:path';
import type { BackendService } from '#src/cli/app/backend/backend-service';
import { type BackendInfo, resolveLocalBackendPath } from '#src/cli/app/backend/backend-shapes';
import type { ConfigService } from '#src/cli/app/config/config-service';
import type { Environment } from '#src/cli/app/environment/environment-shapes';
import type { Vfs } from '#src/lib/vfs';

export class LocalBackendService implements BackendService {
	configService: ConfigService;
	vfs: Vfs;

	constructor(vfs: Vfs, configService: ConfigService) {
		this.configService = configService;
		this.vfs = vfs;
	}

	async fileExists(_environment: Environment, targetPath: string): Promise<boolean> {
		const localPath = await this.resolvePath(targetPath);

		return this.vfs.fileExists(localPath);
	}

	async readFile(_environment: Environment, targetPath: string): Promise<Uint8Array> {
		const localPath = await this.resolvePath(targetPath);

		return this.vfs.readFile(localPath);
	}

	async getFilePath(_environment: Environment, targetPath: string): Promise<string> {
		const localPath = await this.resolvePath(targetPath);

		return `./${localPath}`;
	}

	async getInfo(_environment: Environment): Promise<BackendInfo> {
		const config = await this.configService.get();
		const localPath = resolveLocalBackendPath(config.work_path);

		return {
			fields: [
				{
					name: 'local_path',
					value: `./${localPath}`,
				},
			],
			type: 'local',
		};
	}

	async getLastModifiedDate(_environment: Environment, _targetPath: string): Promise<Date | null> {
		return null;
	}

	async listDirectory(_environment: Environment, targetPath: string): Promise<string[]> {
		const localPath = await this.resolvePath(targetPath);

		return this.vfs.listDirectory(localPath);
	}

	async readTextFile(_environment: Environment, targetPath: string): Promise<string> {
		const localPath = await this.resolvePath(targetPath);

		return this.vfs.readTextFile(localPath);
	}

	async removeFile(_environment: Environment, targetPath: string): Promise<void> {
		const localPath = await this.resolvePath(targetPath);

		await this.vfs.removeFile(localPath);
	}

	async writeTextFile(_environment: Environment, targetPath: string, contents: string): Promise<void> {
		const localPath = await this.resolvePath(targetPath);

		await this.vfs.writeTextFile(localPath, contents);
	}

	async writeFile(_environment: Environment, targetPath: string, contents: Uint8Array): Promise<void> {
		const localPath = await this.resolvePath(targetPath);

		await this.vfs.writeFile(localPath, contents);
	}

	private async resolvePath(targetPath: string): Promise<string> {
		const config = await this.configService.get();
		const localPath = resolveLocalBackendPath(config.work_path);

		return path.posix.join(localPath, targetPath);
	}
}
