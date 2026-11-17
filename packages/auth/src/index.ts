// ABOUTME: Barrel export for the @pleasehold/auth package (server-side).
// ABOUTME: Re-exports auth configuration and types.

export type { Auth, AuthConfig, AuthOptions } from './config';
export { createAuth } from './config';
export type { AuthSession, AuthUser } from './types';
