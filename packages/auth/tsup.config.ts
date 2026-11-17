// ABOUTME: Build configuration for the @pleasehold/auth package.
// ABOUTME: Produces ESM output with separate server and client entry points.

import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts', 'src/client.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	sourcemap: true,
	external: ['better-auth/react', '@better-auth/api-key/client'],
});
