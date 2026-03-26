import { Tiny } from '@edo-w/tiny';

export function createCommandContainer(entries: Array<[unknown, unknown]>): Tiny {
	const container = new Tiny();

	for (const [key, value] of entries) {
		container.addFactory(key as never, () => {
			return value;
		});
	}

	return container;
}

export function createCommandScope<T>(key: T, value: unknown): Tiny {
	return createCommandContainer([[key, value]]);
}
