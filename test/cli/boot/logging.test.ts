import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';

const { mockConfigure, mockGetConsoleSink, mockGetRotatingFileSink } = vi.hoisted(() => {
	return {
		mockConfigure: vi.fn(async () => {}),
		mockGetConsoleSink: vi.fn(() => 'console-sink'),
		mockGetRotatingFileSink: vi.fn(() => 'file-sink'),
	};
});

vi.mock('@logtape/logtape', async () => {
	const actual = await vi.importActual<typeof import('@logtape/logtape')>('@logtape/logtape');

	return {
		...actual,
		configure: mockConfigure,
		getConsoleSink: mockGetConsoleSink,
	};
});

vi.mock('@logtape/file', () => {
	return {
		getRotatingFileSink: mockGetRotatingFileSink,
	};
});

const { configureKeyAgentLogging, configureLogging, minimalFormatter, verboseFileFormatter, verboseFormatter } =
	await import('#src/cli/boot/logging');

beforeEach(() => {
	mockConfigure.mockReset();
	mockGetConsoleSink.mockReset();
	mockGetRotatingFileSink.mockReset();
	mockGetConsoleSink.mockReturnValue('console-sink');
	mockGetRotatingFileSink.mockReturnValue('file-sink');
});

test('minimalFormatter renders the message with a separator', () => {
	const text = minimalFormatter({
		category: ['mars'],
		level: 'info',
		message: 'hello',
		timestamp: Date.UTC(2026, 0, 1, 1, 2, 3, 4),
	} as never);

	assert.equal(text.includes('hello'), true);
	assert.equal(text.includes('│'), true);
});

test('verboseFormatter renders time, level, category, and message', () => {
	const text = verboseFormatter({
		category: ['mars', 'key-agent'],
		level: 'warning',
		message: 'hello',
		timestamp: Date.UTC(2026, 0, 1, 1, 2, 3, 4),
	} as never);

	assert.equal(text.includes('WRN'), true);
	assert.equal(text.includes('mars:key-agent'), true);
	assert.equal(text.includes('hello'), true);
});

test('verboseFileFormatter appends a newline', () => {
	const text = verboseFileFormatter({
		category: ['mars'],
		level: 'error',
		message: 'boom',
		timestamp: Date.UTC(2026, 0, 1, 1, 2, 3, 4),
	} as never);

	assert.equal(text.endsWith('\n'), true);
	assert.equal(text.includes('ERR'), true);
});

test('configureLogging configures the console sink', async () => {
	await configureLogging();

	assert.equal(mockGetConsoleSink.mock.calls.length, 1);
	assert.equal(mockConfigure.mock.calls.length, 1);
});

test('configureKeyAgentLogging configures console and rotating file sinks', async () => {
	await configureKeyAgentLogging('/repo/.mars/key-agent.log');

	assert.equal(mockGetConsoleSink.mock.calls.length, 1);
	assert.equal(mockGetRotatingFileSink.mock.calls.length, 1);
	assert.equal(mockConfigure.mock.calls.length, 1);
});
