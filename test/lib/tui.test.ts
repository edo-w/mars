import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { Tui } from '#src/lib/tui';

vi.mock('enquirer', () => {
	return {
		default: {
			prompt: vi.fn(),
		},
	};
});

test('Tui.autocomplete returns the selected value', async () => {
	const { default: Enquirer } = await import('enquirer');
	const tui = new Tui();

	vi.mocked(Enquirer.prompt).mockResolvedValueOnce({
		value: 'gl-dev',
	});

	const value = await tui.autocomplete('Select environment', ['gl-dev', 'gl-test']);

	assert.equal(value, 'gl-dev');
});

test('Tui.autocomplete returns null when the prompt throws', async () => {
	const { default: Enquirer } = await import('enquirer');
	const tui = new Tui();

	vi.mocked(Enquirer.prompt).mockRejectedValueOnce(new Error('cancelled'));

	const value = await tui.autocomplete('Select environment', ['gl-dev', 'gl-test']);

	assert.equal(value, null);
});

test('Tui.input returns the entered value', async () => {
	const { default: Enquirer } = await import('enquirer');
	const tui = new Tui();

	vi.mocked(Enquirer.prompt).mockResolvedValueOnce({
		value: 'gl-dev',
	});

	const value = await tui.input('Enter environment');

	assert.equal(value, 'gl-dev');
});

test('Tui.input returns null when the prompt throws', async () => {
	const { default: Enquirer } = await import('enquirer');
	const tui = new Tui();

	vi.mocked(Enquirer.prompt).mockRejectedValueOnce(new Error('cancelled'));

	const value = await tui.input('Enter environment');

	assert.equal(value, null);
});

test('Tui.password returns the entered value', async () => {
	const { default: Enquirer } = await import('enquirer');
	const tui = new Tui();

	vi.mocked(Enquirer.prompt).mockResolvedValueOnce({
		value: 'secret',
	});

	const value = await tui.password('Enter passphrase');

	assert.equal(value, 'secret');
});

test('Tui.password returns null when the prompt throws', async () => {
	const { default: Enquirer } = await import('enquirer');
	const tui = new Tui();

	vi.mocked(Enquirer.prompt).mockRejectedValueOnce(new Error('cancelled'));

	const value = await tui.password('Enter passphrase');

	assert.equal(value, null);
});
