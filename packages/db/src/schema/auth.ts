// ABOUTME: Auth tables required by Better Auth and its API Key plugin.
// ABOUTME: Includes user, session, account, verification, and apikey tables (all owned by Better Auth).

import { boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const authUsers = pgTable('auth_users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => authUsers.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => authUsers.id, { onDelete: 'cascade' }),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
	scope: text('scope'),
	idToken: text('id_token'),
	password: text('password'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const apikeys = pgTable(
	'apikeys',
	{
		id: text('id').primaryKey(),
		configId: text('config_id').notNull().default('default'),
		name: text('name'),
		start: text('start'),
		prefix: text('prefix'),
		key: text('key').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		refillInterval: text('refill_interval'),
		refillAmount: integer('refill_amount'),
		lastRefillAt: timestamp('last_refill_at', { withTimezone: true }),
		enabled: boolean('enabled').notNull().default(true),
		rateLimitEnabled: boolean('rate_limit_enabled').notNull().default(false),
		rateLimitTimeWindow: integer('rate_limit_time_window'),
		rateLimitMax: integer('rate_limit_max'),
		requestCount: integer('request_count').notNull().default(0),
		remaining: integer('remaining'),
		metadata: text('metadata'),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		permissions: text('permissions'),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		lastRequest: timestamp('last_request', { withTimezone: true }),
	},
	(table) => [
		index('apikeys_user_id_idx').on(table.userId),
		index('apikeys_key_idx').on(table.key),
		index('apikeys_enabled_idx').on(table.enabled),
		index('apikeys_config_id_idx').on(table.configId),
	],
);
