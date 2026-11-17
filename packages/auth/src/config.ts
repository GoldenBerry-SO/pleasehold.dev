// ABOUTME: Better Auth configuration factory with email/password and API key plugin support.
// ABOUTME: Configures session handling, social providers (env-gated), and project-scoped API keys.

import { apiKey } from '@better-auth/api-key';
import {
	accounts,
	apikeys,
	authUsers,
	type Database,
	sessions,
	verifications,
} from '@pleasehold/db';
import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export interface AuthOptions {
	/** Database instance */
	db: Database;
	/** Auth secret for signing tokens */
	secret: string;
	/** Base URL for auth callbacks (e.g. http://localhost:3000) */
	baseUrl: string;
	/** Origins allowed to make auth requests (e.g. ['http://localhost:5173']). */
	trustedOrigins?: string[];
	/** Google OAuth credentials. Both required to enable. */
	googleClientId?: string;
	googleClientSecret?: string;
	/** GitHub OAuth credentials. Both required to enable. */
	githubClientId?: string;
	githubClientSecret?: string;
	/** Hook called after a new user is created in auth_users. */
	onUserCreated?: (user: { id: string; email: string; name: string }) => Promise<void>;
	/** Disable API key rate limiting (useful for integration tests). */
	disableApiKeyRateLimit?: boolean;
	/** Send an email (used for verification emails). */
	sendEmail?: (to: string, subject: string, html: string) => Promise<void>;
}

/** The options shape handed to betterAuth(); naming it keeps the emitted instance type small enough for the compiler. */
export type AuthConfig = Omit<BetterAuthOptions, 'plugins'> & {
	plugins: [ReturnType<typeof apiKey>];
};

/** The Better Auth instance createAuth returns. */
export type Auth = ReturnType<typeof betterAuth<AuthConfig>>;

export function createAuth(options: AuthOptions): Auth {
	const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
	if (options.googleClientId && options.googleClientSecret) {
		socialProviders.google = {
			clientId: options.googleClientId,
			clientSecret: options.googleClientSecret,
		};
	}
	if (options.githubClientId && options.githubClientSecret) {
		socialProviders.github = {
			clientId: options.githubClientId,
			clientSecret: options.githubClientSecret,
		};
	}

	const config: AuthConfig = {
		trustedOrigins: options.trustedOrigins,
		database: drizzleAdapter(options.db, {
			provider: 'pg',
			schema: {
				user: authUsers,
				session: sessions,
				account: accounts,
				verification: verifications,
				apikey: apikeys,
			},
		}),
		secret: options.secret,
		baseURL: options.baseUrl,
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 10,
			maxPasswordLength: 128,
			requireEmailVerification: true,
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			expiresIn: 3600,
			sendVerificationEmail: async ({ user, url }) => {
				if (!options.sendEmail) {
					console.warn('[auth] sendEmail not configured — skipping verification email');
					return;
				}
				await options.sendEmail(
					user.email,
					'Verify your email — pleasehold',
					buildVerificationEmailHtml(url),
				);
			},
		},
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days
			updateAge: 60 * 60 * 24, // 1 day
		},
		socialProviders,
		onAPIError: {
			throw: true,
		},
		plugins: [
			apiKey({
				defaultPrefix: 'ph_live_',
				enableMetadata: true,
				// The plugin names the owner column referenceId; the apikeys table keeps it as user_id.
				schema: { apikey: { fields: { referenceId: 'userId' } } },
				...(options.disableApiKeyRateLimit ? { rateLimit: { enabled: false } } : {}),
			}),
		],
		databaseHooks: {
			user: {
				create: {
					after: async (user) => {
						if (options.onUserCreated) {
							await options.onUserCreated({
								id: user.id,
								email: user.email,
								name: user.name,
							});
						}
					},
				},
			},
		},
	};
	return betterAuth(config);
}

function buildVerificationEmailHtml(url: string): string {
	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;max-width:480px">
<tr><td style="text-align:center;padding-bottom:24px">
  <span style="font-size:20px;font-weight:700;color:#0d9488">pleasehold</span>
</td></tr>
<tr><td style="text-align:center;padding-bottom:16px">
  <h1 style="margin:0;font-size:22px;font-weight:600;color:#18181b">Verify your email</h1>
</td></tr>
<tr><td style="text-align:center;padding-bottom:32px;color:#52525b;font-size:15px;line-height:1.5">
  Click the button below to verify your email address and activate your account.
</td></tr>
<tr><td style="text-align:center;padding-bottom:32px">
  <a href="${url}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px">
    Verify email
  </a>
</td></tr>
<tr><td style="text-align:center;color:#a1a1aa;font-size:13px;line-height:1.5">
  This link expires in 1 hour. If you didn't create an account, you can safely ignore this email.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
