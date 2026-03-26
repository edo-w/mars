import { vi } from 'vitest';
import type { Tui } from '#src/lib/tui';
import type { PublicLike } from '#src/lib/types';

type TuiLike = PublicLike<Tui>;

export class MockTui implements TuiLike {
	autocomplete = vi.fn<(message: string, choices: string[]) => Promise<string | null>>();
	input = vi.fn<(message: string) => Promise<string | null>>();
	password = vi.fn<(message: string) => Promise<string | null>>();

	reset(): void {
		this.autocomplete.mockReset();
		this.input.mockReset();
		this.password.mockReset();
	}
}
