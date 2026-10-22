// ABOUTME: Billing router tests covering duplicate upgrades, session reuse, and customer portal configuration.
// ABOUTME: Stripe and persistence are mocked so the checks cannot create charges or modify accounts.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '../context';

const {
	findFirst,
	insert,
	values,
	onConflictDoUpdate,
	customerCreate,
	listSubscriptions,
	listSessions,
	createSession,
	portalSession,
} = vi.hoisted(() => ({
	findFirst: vi.fn(),
	insert: vi.fn(),
	values: vi.fn(),
	onConflictDoUpdate: vi.fn(),
	customerCreate: vi.fn(),
	listSubscriptions: vi.fn(),
	listSessions: vi.fn(),
	createSession: vi.fn(),
	portalSession: vi.fn(),
}));
vi.mock('stripe', () => ({
	default: class {
		customers = { create: customerCreate };
		subscriptions = { list: listSubscriptions };
		checkout = { sessions: { list: listSessions, create: createSession } };
		billingPortal = { sessions: { create: portalSession } };
	},
}));

import { subscriptionRouter } from './subscription';

const caller = subscriptionRouter.createCaller({
	db: { query: { subscriptions: { findFirst } }, insert },
	user: { id: 'user-1', email: 'billing@example.com' },
	session: { id: 'session-1' },
} as unknown as Context);
const free = {
	plan: 'free',
	stripeCustomerId: 'cus_123',
	stripeSubscriptionId: null,
	currentPeriodEnd: null,
	cancelAtPeriodEnd: false,
};

beforeEach(() => {
	vi.resetAllMocks();
	process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
	process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
	process.env.WEB_URL = 'https://app.pleasehold.dev';
	process.env.STRIPE_PORTAL_CONFIGURATION_ID = 'bpc_pleasehold';
	findFirst.mockResolvedValue(free);
	listSubscriptions.mockReturnValue([]);
	listSessions.mockResolvedValue({ data: [] });
	createSession.mockResolvedValue({ url: 'https://checkout.stripe.com/session' });
	portalSession.mockResolvedValue({ url: 'https://billing.stripe.com/session' });
	customerCreate.mockResolvedValue({ id: 'cus_new' });
	insert.mockReturnValue({ values });
	values.mockReturnValue({ onConflictDoUpdate });
	onConflictDoUpdate.mockResolvedValue([]);
});

describe('subscription billing', () => {
	it.each([
		{ ...free, plan: 'pro' },
		{ ...free, stripeSubscriptionId: 'sub_pending' },
	])('prevents an existing plan from starting another checkout', async (sub) => {
		findFirst.mockResolvedValue(sub);
		await expect(caller.createCheckoutSession()).rejects.toMatchObject({ code: 'CONFLICT' });
		expect(createSession).not.toHaveBeenCalled();
	});
	it('prevents duplicate billing while a successful payment webhook is delayed', async () => {
		listSubscriptions.mockReturnValue([
			{ status: 'active', items: { data: [{ price: { id: 'price_pro' } }] } },
		]);
		await expect(caller.createCheckoutSession()).rejects.toMatchObject({ code: 'CONFLICT' });
		expect(createSession).not.toHaveBeenCalled();
	});
	it('reuses an open Checkout session for the same purchase', async () => {
		listSessions.mockResolvedValue({
			data: [
				{
					metadata: { userId: 'user-1', priceId: 'price_pro' },
					url: 'https://checkout.stripe.com/existing',
					status: 'open',
				},
			],
		});
		expect(await caller.createCheckoutSession()).toEqual({
			url: 'https://checkout.stripe.com/existing',
		});
		expect(createSession).not.toHaveBeenCalled();
	});
	it('starts a fresh idempotent attempt after a Checkout session expires', async () => {
		listSessions.mockResolvedValue({
			data: [
				{
					id: 'cs_expired',
					status: 'expired',
					metadata: { userId: 'user-1', priceId: 'price_pro' },
				},
			],
		});
		await caller.createCheckoutSession();
		expect(createSession).toHaveBeenCalledWith(expect.anything(), {
			idempotencyKey: 'pleasehold:checkout:user-1:price_pro:cs_expired',
		});
	});
	it('creates and persists a missing customer before opening recurring Checkout', async () => {
		findFirst.mockResolvedValue(undefined);
		await caller.createCheckoutSession();
		expect(onConflictDoUpdate).toHaveBeenCalled();
		expect(createSession).toHaveBeenCalledWith(
			expect.objectContaining({
				customer: 'cus_new',
				mode: 'subscription',
				payment_method_types: ['card'],
				line_items: [{ price: 'price_pro', quantity: 1 }],
				subscription_data: { metadata: { userId: 'user-1', app: 'pleasehold' } },
				success_url: 'https://app.pleasehold.dev/settings/billing?success=true',
			}),
			expect.objectContaining({
				idempotencyKey: expect.stringContaining('pleasehold:checkout:user-1:price_pro:'),
			}),
		);
	});
	it('allows a new purchase after a canceled subscription', async () => {
		listSubscriptions.mockReturnValue([
			{ status: 'canceled', items: { data: [{ price: { id: 'price_pro' } }] } },
		]);
		await caller.createCheckoutSession();
		expect(createSession).toHaveBeenCalled();
	});
	it('rejects an unusable Checkout response', async () => {
		createSession.mockResolvedValue({ url: null });
		await expect(caller.createCheckoutSession()).rejects.toMatchObject({
			code: 'INTERNAL_SERVER_ERROR',
		});
	});
	it('opens the Please Hold portal with an app return link', async () => {
		await caller.createPortalSession();
		expect(portalSession).toHaveBeenCalledWith({
			customer: 'cus_123',
			configuration: 'bpc_pleasehold',
			return_url: 'https://app.pleasehold.dev/settings/billing',
		});
	});
	it('distinguishes complimentary Pro access from recurring billing', async () => {
		findFirst.mockResolvedValue({ ...free, plan: 'pro', stripeCustomerId: null });
		expect(await caller.get()).toMatchObject({
			plan: 'pro',
			hasBillingAccount: false,
			hasStripeSubscription: false,
		});
	});
});
