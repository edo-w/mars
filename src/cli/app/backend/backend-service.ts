import type { BackendInfo } from '#src/cli/app/backend/backend-shapes';
import type { Environment } from '#src/cli/app/environment/environment-shapes';

export interface BackendService {
	fileExists(environment: Environment, targetPath: string): Promise<boolean>;
	getFilePath(environment: Environment, targetPath: string): Promise<string>;
	getInfo(environment: Environment): Promise<BackendInfo>;
	getLastModifiedDate(environment: Environment, targetPath: string): Promise<Date | null>;
	listDirectory(environment: Environment, targetPath: string): Promise<string[]>;
	readTextFile(environment: Environment, targetPath: string): Promise<string>;
	removeFile(environment: Environment, targetPath: string): Promise<void>;
	writeTextFile(environment: Environment, targetPath: string, contents: string): Promise<void>;
}
