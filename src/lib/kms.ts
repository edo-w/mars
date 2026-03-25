export function isMissingKmsKeyError(error: unknown): boolean {
	const isObject = typeof error === 'object' && error !== null;
	const hasName = isObject && 'name' in error;

	if (!hasName) {
		return false;
	}

	return error.name === 'NotFoundException';
}

export function isMissingKmsAliasError(error: unknown): boolean {
	const isObject = typeof error === 'object' && error !== null;
	const hasName = isObject && 'name' in error;

	if (!hasName) {
		return false;
	}

	return error.name === 'NotFoundException';
}
