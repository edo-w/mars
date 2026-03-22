import fsp from 'node:fs/promises';
import path from 'node:path';

export class Vfs {
	cwd: string;

	constructor(cwd: string) {
		this.cwd = cwd;
	}

	async directoryExists(targetPath: string): Promise<boolean> {
		try {
			const targetStat = await fsp.stat(this.resolve(targetPath));

			return targetStat.isDirectory();
		} catch (error) {
			if (!isMissingPathError(error)) {
				throw error;
			}

			return false;
		}
	}

	async ensureDirectory(targetPath: string): Promise<void> {
		await fsp.mkdir(this.resolve(targetPath), { recursive: true });
	}

	async fileExists(targetPath: string): Promise<boolean> {
		try {
			const targetStat = await fsp.stat(this.resolve(targetPath));

			return targetStat.isFile();
		} catch (error) {
			if (!isMissingPathError(error)) {
				throw error;
			}

			return false;
		}
	}

	async removeFile(targetPath: string): Promise<void> {
		try {
			await fsp.rm(this.resolve(targetPath));
		} catch (error) {
			if (!isMissingPathError(error)) {
				throw error;
			}
		}
	}

	async listDirectory(targetPath: string): Promise<string[]> {
		try {
			return await fsp.readdir(this.resolve(targetPath));
		} catch (error) {
			if (!isMissingPathError(error)) {
				throw error;
			}

			return [];
		}
	}

	async readTextFile(targetPath: string): Promise<string> {
		return fsp.readFile(this.resolve(targetPath), 'utf8');
	}

	resolve(...pathParts: string[]): string {
		return path.resolve(this.cwd, ...pathParts);
	}

	async writeTextFile(targetPath: string, contents: string): Promise<void> {
		const resolvedPath = this.resolve(targetPath);
		const parentDirectoryPath = path.dirname(resolvedPath);

		await fsp.mkdir(parentDirectoryPath, { recursive: true });
		await fsp.writeFile(resolvedPath, contents, 'utf8');
	}
}

export function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
