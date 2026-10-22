// ABOUTME: Billing settings page showing current plan, usage stats, and upgrade/manage buttons.
// ABOUTME: Free users see upgrade CTA; Pro users see Stripe portal link; self-hosted shows all-unlocked.

import confetti from 'canvas-confetti';
import { Check, Crown, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBillingEnabled, useSubscription, useSubscriptionUsage } from '@/hooks/useSubscription';
import { capture } from '@/lib/tracking';
import { trpc } from '@/lib/trpc';

export function BillingPanel({ source = 'billing_page' }: { source?: string }) {
	const [checkoutReturn] = useState(
		() => new URLSearchParams(window.location.search).get('success') === 'true',
	);
	const [checkoutCanceled] = useState(
		() => new URLSearchParams(window.location.search).get('canceled') === 'true',
	);
	const [confirmationTimedOut, setConfirmationTimedOut] = useState(false);
	const utils = trpc.useUtils();
	const { data: billing, isPending: billingLoading, error: billingError } = useBillingEnabled();
	const {
		data: sub,
		isPending: subLoading,
		error: subError,
		refetch,
	} = useSubscription(checkoutReturn && !confirmationTimedOut);
	const { data: usage, isPending: usageLoading } = useSubscriptionUsage();

	const checkout = trpc.subscription.createCheckoutSession.useMutation({
		onSuccess: (data) => {
			capture('upgrade_clicked', { source });
			if (data.url) window.location.href = data.url;
		},
	});

	const portal = trpc.subscription.createPortalSession.useMutation({
		onSuccess: (data) => {
			capture('manage_billing_clicked');
			if (data.url) window.location.href = data.url;
		},
	});

	const plan = sub?.plan ?? 'free';
	const billingEnabled = billing?.enabled ?? false;
	const confettiFired = useRef(false);

	useEffect(() => {
		if (!billingLoading && !subLoading) {
			capture('billing_page_viewed', { plan, billingEnabled });
		}
	}, [billingLoading, subLoading, plan, billingEnabled]);

	useEffect(() => {
		if (!checkoutReturn || confirmationTimedOut) return;
		const timer = setTimeout(() => setConfirmationTimedOut(true), 60_000);
		return () => clearTimeout(timer);
	}, [checkoutReturn, confirmationTimedOut]);

	// A redirect alone is not proof of payment. Celebrate only after the server grants Pro.
	useEffect(() => {
		if (!checkoutReturn || sub?.plan !== 'pro' || confettiFired.current) return;
		confettiFired.current = true;
		void utils.subscription.getUsage.invalidate();
		const params = new URLSearchParams(window.location.search);
		params.delete('success');
		const query = params.toString();
		window.history.replaceState(
			window.history.state,
			'',
			`${window.location.pathname}${query ? `?${query}` : ''}`,
		);
		confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, disableForReducedMotion: true });
	}, [checkoutReturn, sub?.plan, utils]);

	if (billingError || subError) {
		return (
			<div role="alert" className="space-y-3 text-sm">
				<p>We couldn’t load your billing details. Please try again.</p>
				<Button
					variant="outline"
					onClick={() => {
						void utils.subscription.invalidate();
					}}
				>
					Try again
				</Button>
			</div>
		);
	}

	if (billingLoading || subLoading || usageLoading) {
		return (
			<div className="py-16 text-center">
				<p className="text-muted">Loading billing...</p>
			</div>
		);
	}

	// Self-hosted mode
	if (!billing?.enabled) {
		return (
			<div className="mx-auto max-w-4xl">
				<h1 className="mb-1 text-xl font-semibold text-foreground">Billing</h1>
				<p className="mb-6 text-sm text-muted-foreground">Manage your subscription.</p>

				<div className="rounded-lg border border-border bg-card p-6">
					<div className="flex items-center gap-3 mb-3">
						<Zap className="h-5 w-5 text-primary" />
						<h2 className="text-base font-semibold text-foreground">Self-Hosted Mode</h2>
					</div>
					<p className="text-sm text-muted-foreground">
						All features are unlocked. Self-hosted instances have no restrictions.
					</p>
				</div>
			</div>
		);
	}

	const isPro = plan === 'pro';
	const waitingForPayment = checkoutReturn && !isPro;
	const canUpgrade = !isPro && !sub?.hasStripeSubscription && !waitingForPayment;
	const entriesPercent =
		usage && usage.maxEntriesPerMonth !== Number.POSITIVE_INFINITY
			? Math.min(100, (usage.entriesThisMonth / usage.maxEntriesPerMonth) * 100)
			: 0;

	return (
		<div className="mx-auto max-w-4xl">
			<h1 className="mb-1 text-xl font-semibold text-foreground">Billing</h1>
			<p className="mb-6 text-sm text-muted-foreground">Manage your subscription and usage.</p>

			{checkoutReturn && (
				<output className="mb-6 block rounded-lg border border-border bg-card p-4 text-sm">
					{isPro
						? 'You’re on Pro. Thanks for upgrading!'
						: confirmationTimedOut
							? 'Your payment is still being confirmed. Check back here shortly; you don’t need to pay again.'
							: 'Confirming your payment… Your Pro access will appear here automatically.'}
					{waitingForPayment && confirmationTimedOut && (
						<Button
							className="ml-2"
							variant="outline"
							size="sm"
							onClick={() => {
								setConfirmationTimedOut(false);
								void refetch();
							}}
						>
							Refresh status
						</Button>
					)}
				</output>
			)}
			{checkoutCanceled && !checkoutReturn && (
				<output className="mb-6 block text-sm text-muted-foreground">
					Checkout canceled. Your plan hasn’t changed.
				</output>
			)}
			{(checkout.error || portal.error) && (
				<p
					role="alert"
					className="mb-6 rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
				>
					{checkout.error?.data?.code === 'CONFLICT'
						? checkout.error.message
						: 'We couldn’t open billing. Please try again in a moment.'}
				</p>
			)}

			{/* Current plan */}
			<div className="mb-6">
				<h2 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
					Current Plan
				</h2>
				<div className="rounded-lg border border-border bg-card p-5">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							{isPro ? (
								<Crown className="h-5 w-5 text-amber-500" />
							) : (
								<Zap className="h-5 w-5 text-muted-foreground" />
							)}
							<div>
								<div className="flex items-center gap-2">
									<span className="text-base font-semibold text-foreground">
										{isPro ? 'Pro' : 'Free'}
									</span>
									{isPro && (
										<Badge
											variant="secondary"
											className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-0"
										>
											Active
										</Badge>
									)}
								</div>
								{isPro && sub?.currentPeriodEnd && (
									<p className="text-xs text-muted-foreground">
										{!sub.hasStripeSubscription
											? 'Access ends'
											: sub.cancelAtPeriodEnd
												? 'Cancels'
												: 'Renews'}{' '}
										on {new Date(sub.currentPeriodEnd).toLocaleDateString()}
									</p>
								)}
							</div>
						</div>
						{sub?.hasBillingAccount && (isPro || sub.hasStripeSubscription) ? (
							<Button
								variant="outline"
								size="sm"
								className="h-8 text-xs"
								disabled={portal.isPending}
								onClick={() => portal.mutate()}
							>
								{portal.isPending ? 'Loading...' : 'Manage Billing'}
							</Button>
						) : canUpgrade ? (
							<Button
								size="sm"
								className="h-8 text-xs"
								disabled={checkout.isPending}
								onClick={() => checkout.mutate()}
							>
								{checkout.isPending ? 'Loading...' : 'Upgrade — €19/3 months'}
							</Button>
						) : null}
					</div>
					{isPro && !sub?.hasStripeSubscription && (
						<p className="mt-3 text-xs text-muted-foreground">
							Your Pro access does not renew automatically.
						</p>
					)}
					{!isPro && sub?.hasStripeSubscription && (
						<p className="mt-3 text-xs text-muted-foreground">
							Your subscription needs attention. Open Manage Billing to review your payment details.
						</p>
					)}
					{!isPro && sub?.hasBillingAccount && !sub.hasStripeSubscription && (
						<Button
							variant="link"
							className="mt-3 h-auto p-0 text-xs"
							disabled={portal.isPending}
							onClick={() => portal.mutate()}
						>
							Billing history and payment details
						</Button>
					)}
				</div>
			</div>

			{/* Usage stats */}
			{usage && (
				<div className="mb-6">
					<h2 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Usage</h2>
					<div className="border-t border-border/50">
						{/* Entries */}
						<div className="border-b border-border/50 py-3">
							<div className="flex items-center justify-between mb-1">
								<span className="text-sm text-foreground">Entries this month</span>
								<span className="text-sm text-muted-foreground">
									{usage.entriesThisMonth.toLocaleString()}
									{usage.maxEntriesPerMonth !== Number.POSITIVE_INFINITY
										? ` / ${usage.maxEntriesPerMonth.toLocaleString()}`
										: ' / Unlimited'}
								</span>
							</div>
							{usage.maxEntriesPerMonth !== Number.POSITIVE_INFINITY && (
								<div className="h-1.5 w-full rounded-full bg-muted">
									<div
										className="h-1.5 rounded-full bg-primary transition-all"
										style={{ width: `${entriesPercent}%` }}
									/>
								</div>
							)}
						</div>

						{/* Projects */}
						<div className="border-b border-border/50 py-3">
							<div className="flex items-center justify-between">
								<span className="text-sm text-foreground">Projects</span>
								<span className="text-sm text-muted-foreground">
									{usage.projectCount}
									{usage.maxProjects !== Number.POSITIVE_INFINITY
										? ` / ${usage.maxProjects}`
										: ' / Unlimited'}
								</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Pro features list (for free users) */}
			{canUpgrade && (
				<div className="mb-6">
					<h2 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
						Pro includes
					</h2>
					<div className="rounded-lg border border-border bg-card p-5">
						<ul className="space-y-2">
							{[
								'Unlimited entries per month',
								'Unlimited projects',
								'Custom email templates',
								'Custom branding & colors',
								'"Powered by pleasehold" badge removed',
								'Priority support',
							].map((feat) => (
								<li key={feat} className="flex items-center gap-2 text-sm text-foreground">
									<Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
									{feat}
								</li>
							))}
						</ul>
						<Button
							className="mt-4 h-8 text-xs"
							disabled={checkout.isPending}
							onClick={() => checkout.mutate()}
						>
							{checkout.isPending ? 'Loading...' : 'Upgrade — €19/3 months'}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
