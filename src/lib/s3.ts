export function isMissingBucketError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null || !('name' in error)) {
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
