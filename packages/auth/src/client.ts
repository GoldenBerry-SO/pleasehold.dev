// ABOUTME: Browser-side Better Auth client factory with API key plugin support.
// ABOUTME: Used by the web dashboard -- imports only client-safe dependencies.

import { apiKeyClient } from '@better-auth/api-key/client';
import { createAuthClient as createBetterAuthClient } from 'better-auth/react';

export interface AuthClientOptions {
	/** Base URL of the API server (e.g. '' for same-origin, 'http://localhost:3000' for cross-origin) */
	baseURL: string;
}

export function createAuthClient(options: AuthClientOptions) {
	return createBetterAuthClient({
		baseURL: options.baseURL,
		plugins: [apiKeyClient()],
	});
}

export type AuthClient = ReturnType<typeof createAuthClient>;
