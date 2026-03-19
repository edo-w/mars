import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'#src': path.resolve(rootDir, 'src'),
			'#test': path.resolve(rootDir, 'test'),
		},
	},
	test: {
		dir: 'test',
		passWithNoTests: true,
	},
});
