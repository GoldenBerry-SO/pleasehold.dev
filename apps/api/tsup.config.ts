// ABOUTME: Build configuration for the API service using tsup.
// ABOUTME: Produces a single bundled ESM entry point for Node.js with workspace packages inlined.

import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	target: 'node22',
	dts: false,
	clean: true,
	sourcemap: true,
	banner: {
		js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
	},
	noExternal: [/@pleasehold\/.*/],
	external: ['better-auth', 'better-auth/adapters/drizzle', '@better-auth/api-key'],
});
