// ABOUTME: Overlay component that blocks Pro-only features for free-plan users with upgrade CTA.
// ABOUTME: Wraps children and shows a semi-transparent overlay with "Upgrade to Pro" link.

import { Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { useEffect } from 'react';
import { useBillingEnabled, useSubscription } from '@/hooks/useSubscription';
import { capture } from '@/lib/tracking';

interface ProFeatureGateProps {
	children: React.ReactNode;
	feature?: string;
}

export function ProFeatureGate({ children, feature }: ProFeatureGateProps) {
	const { data: billing } = useBillingEnabled();
	const { data: sub } = useSubscription();

	const isGated = billing?.enabled && sub?.plan !== 'pro';

	useEffect(() => {
		if (isGated) {
			capture('pro_feature_gate_shown', { feature: feature ?? 'unknown' });
		}
	}, [isGated, feature]);

	// Self-hosted or billing not enabled: show everything
	if (!billing?.enabled) return <>{children}</>;

	// Pro users: show everything
	if (sub?.plan === 'pro') return <>{children}</>;

	// Free users: overlay with upgrade CTA
	return (
		<div className="relative">
			<div className="pointer-events-none select-none opacity-40">{children}</div>
			<div className="absolute inset-0 flex items-center justify-center">
				<div className="rounded-lg border border-border bg-background/95 px-6 py-4 text-center shadow-sm backdrop-blur-sm">
					<Lock className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
					<p className="mb-1 text-sm font-medium text-foreground">
						{feature ?? 'This feature'} is available on Pro
					</p>
					<Link
						to="/settings/billing"
						className="text-sm font-medium text-primary hover:underline"
						onClick={() =>
							capture('upgrade_clicked', { source: 'feature_gate', feature: feature ?? 'unknown' })
						}
					>
						Upgrade &mdash; €19/3 months
					</Link>
				</div>
			</div>
		</div>
	);
}
