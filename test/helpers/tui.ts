import { afterEach, beforeEach } from 'vitest';
import { Tui } from '#src/lib/tui';
import { createCommandContainer } from '#test/helpers/command-container';
import { MockTui } from '#test/mocks/mock-tui';

export function useMockTui() {
	const tui = new MockTui();

	beforeEach(() => {
		tui.reset();
	});

	afterEach(() => {
		tui.reset();
	});

	return tui;
}

export function withMockTui(entries: Array<[unknown, unknown]>, tui: MockTui) {
	return createCommandContainer([[Tui, tui], ...entries]);
}
