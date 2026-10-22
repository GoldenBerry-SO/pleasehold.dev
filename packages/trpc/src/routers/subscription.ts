// ABOUTME: tRPC router for subscription management: plan info, usage stats, and Stripe checkout/portal sessions.
// ABOUTME: All procedures are authenticated; Stripe calls require billing to be enabled (STRIPE_SECRET_KEY set).

import { entries, projects, subscriptions } from '@pleasehold/db';
import { TRPCError } from '@trpc/server';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { isBillingEnabled, PLAN_LIMITS } from '../lib/plan-limits';
import { protectedProcedure, publicProcedure, router } from '../trpc';

function getStripe(): Stripe {
	const key = process.env.STRIPE_SECRET_KEY;
	if (!key) {
		throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Billing is not enabled' });
	}
	return new Stripe(key);
}

export const subscriptionRouter = router({
	isEnabled: publicProcedure.query(() => {
		return { enabled: isBillingEnabled() };
	}),

	get: protectedProcedure.query(async ({ ctx }) => {
		const sub = await ctx.db.query.subscriptions.findFirst({
			where: eq(subscriptions.userId, ctx.user.id),
		});

		if (!sub) {
			return {
				plan: 'free' as const,
				currentPeriodEnd: null,
				cancelAtPeriodEnd: false,
				hasBillingAccount: false,
				hasStripeSubscription: false,
			};
		}

		return {
			plan: sub.plan as 'free' | 'pro',
			currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
			cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
			hasBillingAccount: !!sub.stripeCustomerId,
			hasStripeSubscription: !!sub.stripeSubscriptionId,
		};
	}),

	getUsage: protectedProcedure.query(async ({ ctx }) => {
		const sub = await ctx.db.query.subscriptions.findFirst({
			where: eq(subscriptions.userId, ctx.user.id),
			columns: { plan: true },
		});

		const plan = (sub?.plan ?? 'free') as 'free' | 'pro';
		const limits = PLAN_LIMITS[plan];

		const [projectResult] = await ctx.db
			.select({ count: count() })
			.from(projects)
			.where(eq(projects.userId, ctx.user.id));

		// Count entries this calendar month across all user's projects
		const startOfMonth = new Date();
		startOfMonth.setDate(1);
		startOfMonth.setHours(0, 0, 0, 0);

		const userProjectIds = ctx.db
			.select({ id: projects.id })
			.from(projects)
			.where(eq(projects.userId, ctx.user.id));

		const [entryResult] = await ctx.db
			.select({ count: count() })
			.from(entries)
			.where(
				and(sql`${entries.projectId} IN (${userProjectIds})`, gte(entries.createdAt, startOfMonth)),
			);

		return {
			plan,
			entriesThisMonth: entryResult.count,
			maxEntriesPerMonth: limits.maxEntriesPerMonth,
			projectCount: projectResult.count,
			maxProjects: limits.maxProjects,
		};
	}),

	createCheckoutSession: protectedProcedure.mutation(async ({ ctx }) => {
		const stripe = getStripe();

		const priceId = process.env.STRIPE_PRO_PRICE_ID;
		if (!priceId) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'STRIPE_PRO_PRICE_ID not configured',
			});
		}

		const sub = await ctx.db.query.subscriptions.findFirst({
			where: eq(subscriptions.userId, ctx.user.id),
		});

		if (sub?.plan === 'pro' || sub?.stripeSubscriptionId) {
			throw new TRPCError({
				code: 'CONFLICT',
				message: 'You already have a subscription. Manage it from Billing.',
			});
		}

		let customerId = sub?.stripeCustomerId;
		if (!customerId) {
			const customer = await stripe.customers.create(
				{ email: ctx.user.email, metadata: { userId: ctx.user.id, app: 'pleasehold' } },
				{ idempotencyKey: `pleasehold:customer:${ctx.user.id}` },
			);
			customerId = customer.id;
			await ctx.db
				.insert(subscriptions)
				.values({
					userId: ctx.user.id,
					stripeCustomerId: customerId,
				})
				.onConflictDoUpdate({
					target: subscriptions.userId,
					set: { stripeCustomerId: customerId, updatedAt: new Date() },
				});
		}

		// A payment can finish before its webhook arrives. Check Stripe before selling again.
		const existingSubscriptions = stripe.subscriptions.list({
			customer: customerId,
			status: 'all',
		});
		for await (const existing of existingSubscriptions) {
			if (
				existing.status !== 'canceled' &&
				existing.status !== 'incomplete_expired' &&
				existing.items.data.some((item) => item.price.id === priceId)
			) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: 'You already have a subscription. Manage it from Billing.',
				});
			}
		}
		const sessions = await stripe.checkout.sessions.list({
			customer: customerId,
			limit: 100,
		});
		const previousSessions = sessions.data.filter(
			(session) =>
				session.metadata?.userId === ctx.user.id && session.metadata?.priceId === priceId,
		);
		const openSession = previousSessions.find((session) => session.status === 'open');
		if (openSession?.url) return { url: openSession.url };

		const webUrl = process.env.WEB_URL ?? 'http://localhost:5173';
		const session = await stripe.checkout.sessions.create(
			{
				customer: customerId,
				mode: 'subscription',
				// Cards (including supported wallets) confirm payment before access is granted.
				payment_method_types: ['card'],
				line_items: [{ price: priceId, quantity: 1 }],
				success_url: `${webUrl}/settings/billing?success=true`,
				cancel_url: `${webUrl}/settings/billing?canceled=true`,
				metadata: { userId: ctx.user.id, app: 'pleasehold', priceId },
				subscription_data: { metadata: { userId: ctx.user.id, app: 'pleasehold' } },
			},
			{
				// Concurrent clicks share a session. An expired session starts a fresh attempt.
				idempotencyKey: `pleasehold:checkout:${ctx.user.id}:${priceId}:${previousSessions[0]?.id ?? 'initial'}`,
			},
		);
		if (!session.url)
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Unable to open checkout. Please try again.',
			});

		return { url: session.url };
	}),

	createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
		const stripe = getStripe();

		const sub = await ctx.db.query.subscriptions.findFirst({
			where: eq(subscriptions.userId, ctx.user.id),
			columns: { stripeCustomerId: true },
		});

		if (!sub?.stripeCustomerId) {
			throw new TRPCError({
				code: 'PRECONDITION_FAILED',
				message: 'No billing account found',
			});
		}

		const webUrl = process.env.WEB_URL ?? 'http://localhost:5173';

		const session = await stripe.billingPortal.sessions.create({
			customer: sub.stripeCustomerId,
			configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID || undefined,
			return_url: `${webUrl}/settings/billing`,
		});

		return { url: session.url };
	}),
});
