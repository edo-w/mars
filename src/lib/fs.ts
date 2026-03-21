export function normalizePath(targetPath: string): string {
	return targetPath.replaceAll('\\', '/');
}
