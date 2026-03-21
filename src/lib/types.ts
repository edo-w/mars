export type PublicLike<T> = {
	[K in keyof T]: T[K];
};
