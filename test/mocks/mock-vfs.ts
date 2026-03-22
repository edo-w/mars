import path from 'node:path';
import type { PublicLike } from '#src/lib/types';
import type { Vfs } from '#src/lib/vfs';

type VfsLike = PublicLike<Vfs>;

export class MockVfs implements VfsLike {
	cwd: string;
	directories: Set<string>;
	files: Map<string, string>;

	constructor(cwd = '/repo') {
		this.cwd = cwd;
		this.directories = new Set([cwd]);
		this.files = new Map();
	}

	addDirectory(targetPath: string): void {
		const resolvedPath = this.resolve(targetPath);
		const directoryPaths = collectDirectoryPaths(resolvedPath);

		for (const directoryPath of directoryPaths) {
			this.directories.add(directoryPath);
		}
	}

	async directoryExists(targetPath: string): Promise<boolean> {
		return this.directories.has(this.resolve(targetPath));
	}

	async ensureDirectory(targetPath: string): Promise<void> {
		const resolvedPath = this.resolve(targetPath);
		const directoryPaths = collectDirectoryPaths(resolvedPath);

		for (const directoryPath of directoryPaths) {
			this.directories.add(directoryPath);
		}
	}

	async fileExists(targetPath: string): Promise<boolean> {
		return this.files.has(this.resolve(targetPath));
	}

	async listDirectory(targetPath: string): Promise<string[]> {
		const resolvedPath = this.resolve(targetPath);

		if (!this.directories.has(resolvedPath)) {
			return [];
		}

		const entryNames = new Set<string>();

		for (const directoryPath of this.directories) {
			const entryName = getDirectChildName(resolvedPath, directoryPath);

			if (entryName !== null) {
				entryNames.add(entryName);
			}
		}

		for (const filePath of this.files.keys()) {
			const entryName = getDirectChildName(resolvedPath, filePath);

			if (entryName !== null) {
				entryNames.add(entryName);
			}
		}

		return [...entryNames].sort((left, right) => left.localeCompare(right));
	}

	async removeFile(targetPath: string): Promise<void> {
		this.files.delete(this.resolve(targetPath));
	}

	async readTextFile(targetPath: string): Promise<string> {
		const contents = this.files.get(this.resolve(targetPath));

		if (contents === undefined) {
			throw new Error(`Missing file: ${targetPath}`);
		}

		return contents;
	}

	resolve(...pathParts: string[]): string {
		return path.posix.resolve(this.cwd, ...pathParts);
	}

	setTextFile(targetPath: string, contents: string): void {
		const resolvedPath = this.resolve(targetPath);
		const directoryPath = path.posix.dirname(resolvedPath);
		const directoryPaths = collectDirectoryPaths(directoryPath);

		for (const parentDirectoryPath of directoryPaths) {
			this.directories.add(parentDirectoryPath);
		}

		this.files.set(resolvedPath, contents);
	}

	async writeTextFile(targetPath: string, contents: string): Promise<void> {
		this.setTextFile(targetPath, contents);
	}
}

function collectDirectoryPaths(targetPath: string): string[] {
	const directoryPaths = new Set<string>();
	const segments = targetPath.split('/').filter(Boolean);

	for (let index = 0; index < segments.length; index += 1) {
		const directoryPath = `/${segments.slice(0, index + 1).join('/')}`;

		directoryPaths.add(directoryPath);
	}

	return [...directoryPaths];
}

function getDirectChildName(parentPath: string, targetPath: string): string | null {
	if (targetPath === parentPath) {
		return null;
	}

	const relativePath = path.posix.relative(parentPath, targetPath);

	if (relativePath.startsWith('..') || relativePath.length === 0) {
		return null;
	}

	const segments = relativePath.split('/');

	return segments.length === 1 ? (segments[0] ?? null) : null;
}
