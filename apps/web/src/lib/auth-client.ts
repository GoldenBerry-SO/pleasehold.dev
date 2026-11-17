// ABOUTME: Singleton Better Auth client instance for the web dashboard.
// ABOUTME: Configured to use the Vite proxy for auth API calls.

import { apiKeyClient } from '@better-auth/api-key/client';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
	baseURL: '',
	plugins: [apiKeyClient()],
});
