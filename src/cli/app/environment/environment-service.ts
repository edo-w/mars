import path from 'node:path';
import { parse, stringify } from 'yaml';
import type { ConfigService } from '#src/cli/app/config/config-service';
import { ENVIRONMENT_FILE, type Environment, EnvironmentConfig } from '#src/cli/app/environment/environment-shapes';
import type { StateService } from '#src/cli/app/state/state-service';
import { normalizePath } from '#src/lib/fs';
import type { Vfs } from '#src/lib/vfs';

export class EnvironmentService {
	configService: ConfigService;
	stateService: StateService;
	vfs: Vfs;

	constructor(vfs: Vfs, configService: ConfigService, stateService: StateService) {
		this.configService = configService;
		this.stateService = stateService;
		this.vfs = vfs;
	}

	async create(name: string): Promise<Environment | null> {
		const config = await this.configService.get();
		const directoryPath = path.posix.join(normalizePath(config.envs_path), normalizePath(name));
		const configPath = path.posix.join(directoryPath, ENVIRONMENT_FILE);

		if (await this.vfs.fileExists(configPath)) {
			return null;
		}

		const environmentConfig = new EnvironmentConfig({
			namespace: config.namespace,
			name,
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

	async getCurrent(): Promise<Environment | null> {
		const selectedEnvironmentPath = await this.stateService.getSelectedEnvironmentPath();

		if (selectedEnvironmentPath === null) {
			return null;
		}

		return this.readEnvironment(selectedEnvironmentPath, selectedEnvironmentPath);
	}

	async list(): Promise<Environment[]> {
		const config = await this.configService.get();
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

	async resolveEnvironment(name: string | null): Promise<Environment | null> {
		if (name !== null) {
			return this.get(name);
		}

		return this.getCurrent();
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
}
