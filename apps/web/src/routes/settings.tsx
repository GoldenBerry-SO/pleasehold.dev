// ABOUTME: User-level settings page showing read-only profile information.
// ABOUTME: Displays name and email from the authenticated session.

import { createFileRoute, Outlet, useMatchRoute } from '@tanstack/react-router';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/settings')({
	component: SettingsRoute,
});

function SettingsRoute() {
	const matchRoute = useMatchRoute();
	return matchRoute({ to: '/settings', fuzzy: false }) ? <UserSettingsPage /> : <Outlet />;
}

function UserSettingsPage() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return (
			<div className="py-16 text-center">
				<p className="text-muted">Loading settings...</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl">
			<h1 className="mb-1 text-xl font-semibold text-foreground">Settings</h1>
			<p className="mb-6 text-sm text-muted-foreground">Manage your account.</p>

			{/* Profile section */}
			<div className="mb-8">
				<h2 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Profile</h2>
				<div className="border-t border-border/50">
					<div className="flex items-center justify-between border-b border-border/50 py-3">
						<div>
							<div className="text-xs text-muted-foreground">Name</div>
							<div className="text-sm text-foreground">{session?.user?.name ?? '—'}</div>
						</div>
					</div>
					<div className="flex items-center justify-between border-b border-border/50 py-3">
						<div>
							<div className="text-xs text-muted-foreground">Email</div>
							<div className="text-sm text-foreground">{session?.user?.email ?? '—'}</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
