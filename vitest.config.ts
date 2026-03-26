import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { CoverageIstanbulOptions } from 'vitest/node';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const coverage = {
	all: true,
	exclude: ['test/**', 'features/**', 'src/cli/main.ts'],
	include: ['src/**/*.ts'],
	reportsDirectory: 'dist/coverage',
	provider: 'istanbul',
	reporter: ['text', 'html'],
};

export default defineConfig({
	resolve: {
		alias: {
			'#src': path.resolve(rootDir, 'src'),
			'#test': path.resolve(rootDir, 'test'),
		},
	},
	test: {
		coverage: coverage as CoverageIstanbulOptions,
		dir: 'test',
		passWithNoTests: true,
	},
});
