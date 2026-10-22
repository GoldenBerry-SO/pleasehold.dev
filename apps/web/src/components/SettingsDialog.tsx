// ABOUTME: Linear-style settings dialog with sidebar tabs for Profile, Billing, and plan management.
// ABOUTME: Replaces separate /settings and /settings/billing routes with a single modal overlay.

import { CreditCard, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BillingPanel } from '@/components/BillingPanel';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

type Tab = 'profile' | 'billing';

interface SettingsDialogProps {
	open: boolean;
	onClose: () => void;
	defaultTab?: Tab;
}

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
	{ id: 'profile', label: 'Profile', icon: User },
	{ id: 'billing', label: 'Billing', icon: CreditCard },
];

export function SettingsDialog({ open, onClose, defaultTab = 'profile' }: SettingsDialogProps) {
	const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

	useEffect(() => {
		if (open) setActiveTab(defaultTab);
	}, [open, defaultTab]);

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent
				className="sm:max-w-[calc(100vw-80px)] sm:max-h-[calc(100vh-80px)] h-[calc(100vh-80px)] p-0 gap-0 overflow-hidden rounded-xl"
				showCloseButton={false}
			>
				<DialogTitle className="sr-only">Settings</DialogTitle>
				<DialogDescription className="sr-only">
					Manage your account and billing settings
				</DialogDescription>

				<div className="flex h-full min-h-0 flex-col sm:flex-row">
					{/* Sidebar */}
					<div className="shrink-0 border-b sm:border-b-0 sm:border-r border-border p-4 flex flex-col sm:w-52">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-sm font-semibold text-foreground">Settings</h2>
							<button
								type="button"
								aria-label="Close settings"
								onClick={onClose}
								className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
						<nav className="flex gap-2 sm:block sm:space-y-px">
							{tabs.map((tab) => {
								const Icon = tab.icon;
								return (
									<button
										key={tab.id}
										type="button"
										onClick={() => setActiveTab(tab.id)}
										className={cn(
											'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors cursor-pointer',
											activeTab === tab.id
												? 'bg-accent font-medium text-foreground'
												: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
										)}
									>
										<Icon className="h-4 w-4" />
										{tab.label}
									</button>
								);
							})}
						</nav>
					</div>

					{/* Content */}
					<div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-8">
						{activeTab === 'profile' && <ProfileTab />}
						{activeTab === 'billing' && <BillingPanel source="settings_dialog" />}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ProfileTab() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) return <TabLoading />;

	return (
		<div>
			<h2 className="text-lg font-semibold text-foreground">Profile</h2>
			<p className="mt-1 text-sm text-muted-foreground">Your account information.</p>

			<div className="mt-6 space-y-5">
				<Field label="Name" value={session?.user?.name ?? '—'} />
				<Field label="Email" value={session?.user?.email ?? '—'} />
			</div>
		</div>
	);
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
			<div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
				{value}
			</div>
		</div>
	);
}

function TabLoading() {
	return (
		<div className="flex h-full items-center justify-center">
			<p className="text-sm text-muted-foreground">Loading...</p>
		</div>
	);
}
