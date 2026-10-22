// ABOUTME: React hook wrapping subscription tRPC queries for plan info and billing status.
// ABOUTME: Provides plan, usage, and billing-enabled state to UI components for feature gating.

import { trpc } from '@/lib/trpc';

export function useSubscription(waitForCheckout = false) {
	return trpc.subscription.get.useQuery(undefined, {
		refetchOnMount: waitForCheckout ? 'always' : true,
		refetchInterval: (query) =>
			waitForCheckout && query.state.data?.plan !== 'pro' ? 2000 : false,
	});
}

export function useSubscriptionUsage() {
	return trpc.subscription.getUsage.useQuery();
}

export function useBillingEnabled() {
	return trpc.subscription.isEnabled.useQuery();
}
