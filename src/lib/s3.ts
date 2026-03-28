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

export async function readS3BodyBytes(body: {
	transformToByteArray?: () => Promise<Uint8Array>;
	transformToString?: () => Promise<string>;
}): Promise<Uint8Array> {
	if (body.transformToByteArray !== undefined) {
		return Uint8Array.from(await body.transformToByteArray());
	}

	if (body.transformToString !== undefined) {
		const contents = await body.transformToString();

		return new TextEncoder().encode(contents);
	}

	throw new Error('unsupported s3 body');
}
