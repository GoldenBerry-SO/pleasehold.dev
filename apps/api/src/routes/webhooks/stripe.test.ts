// ABOUTME: Subscription webhook tests for signatures, payment status, retries, and event ordering.
// ABOUTME: All Stripe and database operations are isolated; no payments or external requests occur.

import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { constructEvent, retrieve, update, set, where, returning, capture } = vi.hoisted(() => ({
	constructEvent: vi.fn(),
	retrieve: vi.fn(),
	update: vi.fn(),
	set: vi.fn(),
	where: vi.fn(),
	returning: vi.fn(),
	capture: vi.fn(),
}));
vi.mock('stripe', () => ({
	default: class {
		webhooks = { constructEvent };
		subscriptions = { retrieve };
	},
}));

vi.mock('../../lib/posthog', () => ({ posthog: { capture } }));

import { createStripeWebhookRoute } from './stripe';

const app = createStripeWebhookRoute({ update } as never);
const price = 'price_pleasehold';
const subscription = (status = 'active') => ({
	id: 'sub_123',
	customer: 'cus_123',
	status,
	metadata: { userId: 'user-1' },
	items: { data: [{ price: { id: price }, current_period_end: 1800000000 }] },
	cancel_at_period_end: false,
});
function event(type = 'customer.subscription.updated', object: unknown = subscription()) {
	constructEvent.mockReturnValue({ type, data: { object } });
}
function request(signature: string | null = 'signed') {
	return app.request('/', {
		method: 'POST',
		body: '{}',
		headers: signature ? { 'stripe-signature': signature } : {},
	});
}
beforeEach(() => {
	vi.resetAllMocks();
	process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
	process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture';
	process.env.STRIPE_PRO_PRICE_ID = price;
	update.mockReturnValue({ set });
	set.mockReturnValue({ where });
	where.mockReturnValue({ returning });
	returning.mockResolvedValue([{ userId: 'user-1' }]);
	retrieve.mockResolvedValue(subscription());
	event();
});

describe('Stripe subscription webhooks', () => {
	it.each([
		'STRIPE_SECRET_KEY',
		'STRIPE_WEBHOOK_SECRET',
		'STRIPE_PRO_PRICE_ID',
	])('fails closed without %s', async (key) => {
		delete process.env[key];
		expect((await request()).status).toBe(500);
		expect(update).not.toHaveBeenCalled();
	});
	it('rejects unsigned and incorrectly signed events', async () => {
		expect((await request(null)).status).toBe(400);
		constructEvent.mockImplementation(() => {
			throw new Error('bad signature');
		});
		expect((await request()).status).toBe(400);
		expect(retrieve).not.toHaveBeenCalled();
	});
	it('grants access after confirmed Checkout and binds only the matching customer and user', async () => {
		event('checkout.session.completed', {
			mode: 'subscription',
			subscription: 'sub_123',
			metadata: { userId: 'user-1' },
		});
		expect((await request()).status).toBe(200);
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({ plan: 'pro', stripeSubscriptionId: 'sub_123' }),
		);
		expect(capture).toHaveBeenCalledWith(
			expect.objectContaining({ distinctId: 'user-1', event: 'subscription_upgraded' }),
		);
		const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
		expect(query.params).toEqual(['cus_123', 'sub_123', 'user-1']);
		expect(query.sql).toContain('"stripe_subscription_id" is null');
	});
	it.each([
		['active', 'pro'],
		['trialing', 'pro'],
		['past_due', 'pro'],
		['incomplete', 'free'],
		['unpaid', 'free'],
		['paused', 'free'],
	])('maps %s to %s, including recovery from unpaid', async (status, plan) => {
		retrieve.mockResolvedValue(subscription(status));
		expect((await request()).status).toBe(200);
		expect(set).toHaveBeenCalledWith(expect.objectContaining({ plan }));
	});
	it.each([
		'canceled',
		'incomplete_expired',
	])('clears ended subscriptions without binding stale purchases: %s', async (status) => {
		event('checkout.session.completed', {
			mode: 'subscription',
			subscription: 'sub_123',
			metadata: { userId: 'user-1' },
		});
		retrieve.mockResolvedValue(subscription(status));
		expect((await request()).status).toBe(200);
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				plan: 'free',
				stripeSubscriptionId: null,
				currentPeriodEnd: null,
				cancelAtPeriodEnd: false,
			}),
		);
		const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
		expect(query.params).toEqual(['cus_123', 'sub_123']);
	});
	it('uses current Stripe state instead of a delayed active event after cancellation', async () => {
		event('customer.subscription.updated', subscription('active'));
		retrieve.mockResolvedValue(subscription('canceled'));
		await request();
		expect(set).toHaveBeenCalledWith(expect.objectContaining({ plan: 'free' }));
	});
	it('preserves Pro until a scheduled cancellation takes effect', async () => {
		retrieve.mockResolvedValue({ ...subscription(), cancel_at_period_end: true });
		await request();
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				plan: 'pro',
				cancelAtPeriodEnd: true,
				currentPeriodEnd: new Date(1800000000000),
			}),
		);
	});
	it.each([
		'customer.subscription.created',
		'customer.subscription.deleted',
		'customer.subscription.paused',
		'customer.subscription.resumed',
	])('handles %s from current state', async (type) => {
		event(type);
		expect((await request()).status).toBe(200);
		expect(retrieve).toHaveBeenCalledWith('sub_123');
	});
	it('ignores other products on the shared GoldenBerry account', async () => {
		retrieve.mockResolvedValue({
			...subscription(),
			items: { data: [{ price: { id: 'price_other' } }] },
		});
		expect((await request()).status).toBe(200);
		expect(update).not.toHaveBeenCalled();
	});
	it('ignores unrelated checkout and event types', async () => {
		event('checkout.session.completed', { mode: 'payment' });
		expect((await request()).status).toBe(200);
		event('invoice.created', {});
		expect((await request()).status).toBe(200);
		expect(retrieve).not.toHaveBeenCalled();
	});
	it('returns 500 for temporary Stripe or database failures so Stripe retries', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		retrieve.mockRejectedValueOnce(new Error('temporarily unavailable'));
		expect((await request()).status).toBe(500);
		returning.mockRejectedValueOnce(new Error('database unavailable'));
		expect((await request()).status).toBe(500);
		log.mockRestore();
	});
});
