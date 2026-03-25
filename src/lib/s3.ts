export function isMissingBucketError(error: unknown): boolean {
	const isObject = typeof error === 'object' && error !== null;
	const hasName = isObject && 'name' in error;

	if (!hasName) {
		return false;
	}

	const httpStatusCode =
		'$metadata' in error &&
		typeof error.$metadata === 'object' &&
		error.$metadata !== null &&
		'httpStatusCode' in error.$metadata &&
		typeof error.$metadata.httpStatusCode === 'number'
			? error.$metadata.httpStatusCode
			: null;

	return error.name === 'NotFound' || error.name === 'NoSuchBucket' || httpStatusCode === 404;
}

export function isMissingObjectError(error: unknown): boolean {
	const isObject = typeof error === 'object' && error !== null;
	const hasName = isObject && 'name' in error;

	if (!hasName) {
		return false;
	}

	const httpStatusCode =
		'$metadata' in error &&
		typeof error.$metadata === 'object' &&
		error.$metadata !== null &&
		'httpStatusCode' in error.$metadata &&
		typeof error.$metadata.httpStatusCode === 'number'
			? error.$metadata.httpStatusCode
			: null;

	return error.name === 'NotFound' || error.name === 'NoSuchKey' || httpStatusCode === 404;
}
