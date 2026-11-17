// ABOUTME: Utility to verify an API key AND confirm it belongs to the specified project.
// ABOUTME: Consumed by Phase 2's API middleware; isolates metadata-based project scoping in one place.

import type { createAuth } from './config';

interface VerifyResult {
	valid: boolean;
	userId?: string;
	keyId?: string;
}

/**
 * Verifies an API key and checks that it belongs to the specified project.
 * Returns { valid: true, userId, keyId } on success, { valid: false } on failure.
 *
 * Checks both key validity (exists, enabled, not expired) AND metadata.projectId match.
 * Without the projectId check, any valid key from any project could access another
 * project's data (Pitfall 1 from RESEARCH.md).
 */
export async function verifyProjectKey(
	auth: ReturnType<typeof createAuth>,
	key: string,
	projectId: string,
): Promise<VerifyResult> {
	try {
		const result = await auth.api.verifyApiKey({
			body: { key },
		});

		if (!result || !result.valid) {
			return { valid: false };
		}

		// Check metadata.projectId scoping
		// Better Auth returns metadata as Record<string, any> | null (already parsed)
		const metadata = result.key?.metadata;
		if (!metadata) {
			return { valid: false };
		}

		// The key must belong to the requested project
		if (metadata.projectId !== projectId) {
			return { valid: false };
		}

		return {
			valid: true,
			userId: result.key?.referenceId,
			keyId: result.key?.id,
		};
	} catch {
		return { valid: false };
	}
}
