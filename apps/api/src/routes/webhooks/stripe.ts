// ABOUTME: Stripe webhook handler that synchronizes subscription access from Stripe's current state.
// ABOUTME: Signed events are scoped to the configured price and the customer's existing billing record.

import type { Database } from '@pleasehold/db';
import { subscriptions } from '@pleasehold/db';
import { and, eq, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { posthog } from '../../lib/posthog';

export function createStripeWebhookRoute(db: Database) {
	const app = new Hono();

	app.post('/', async (c) => {
		const secretKey = process.env.STRIPE_SECRET_KEY;
		const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
		const priceId = process.env.STRIPE_PRO_PRICE_ID;
		if (!secretKey || !webhookSecret || !priceId) {
			return c.json({ error: 'Stripe not configured' }, 500);
		}

		const stripe = new Stripe(secretKey);
		const signature = c.req.header('stripe-signature');
		if (!signature) return c.json({ error: 'Missing stripe-signature header' }, 400);

		let event: Stripe.Event;
		try {
			event = stripe.webhooks.constructEvent(await c.req.text(), signature, webhookSecret);
		} catch {
			return c.json({ error: 'Invalid signature' }, 400);
		}

		let subscriptionId: string | undefined;
		let checkoutUserId: string | undefined;
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object;
				if (session.mode !== 'subscription' || !session.subscription) break;
				subscriptionId =
					typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
				checkoutUserId = session.metadata?.userId;
				break;
			}
			case 'customer.subscription.created':
			case 'customer.subscription.updated':
			case 'customer.subscription.deleted':
			case 'customer.subscription.paused':
			case 'customer.subscription.resumed':
				subscriptionId = event.data.object.id;
				break;
			default:
				break;
		}

		if (subscriptionId) {
			// Stripe can retry or deliver events out of order. Never restore access from an old snapshot.
			const sub = await stripe.subscriptions.retrieve(subscriptionId);
			const item = sub.items.data.find((item) => item.price.id === priceId);
			if (!item) return c.json({ received: true });
			const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
			const userId = sub.metadata?.userId ?? checkoutUserId;
			const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired';
			// Keep access during renewal retries; revoke it when Stripe marks the bill unpaid.
			const plan = ['active', 'trialing', 'past_due'].includes(sub.status) ? 'pro' : 'free';

			const changed = await db
				.update(subscriptions)
				.set({
					plan,
					stripeSubscriptionId: ended ? null : sub.id,
					currentPeriodEnd:
						!ended && item.current_period_end ? new Date(item.current_period_end * 1000) : null,
					cancelAtPeriodEnd: !ended && sub.cancel_at_period_end,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(subscriptions.stripeCustomerId, customerId),
						or(
							eq(subscriptions.stripeSubscriptionId, sub.id),
							// Bind a new purchase even if subscription.created arrives before Checkout completes.
							userId && !ended
								? and(isNull(subscriptions.stripeSubscriptionId), eq(subscriptions.userId, userId))
								: undefined,
						),
					),
				)
				.returning({ userId: subscriptions.userId });
			if (changed.length > 0) {
				posthog.capture({
					distinctId: changed[0].userId,
					event: ended
						? 'subscription_canceled'
						: checkoutUserId && plan === 'pro'
							? 'subscription_upgraded'
							: 'subscription_updated',
					properties: {
						subscriptionId,
						customerId,
						status: sub.status,
						cancelAtPeriodEnd: sub.cancel_at_period_end,
						$insert_id: event.id,
					},
				});
			}
		}

		return c.json({ received: true });
	});
	return app;
}
