// ABOUTME: Notification settings page for configuring per-project notification channels.
// ABOUTME: Allows adding, editing, removing, and toggling notification channels and double opt-in.

import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { NotificationChannelForm } from '@/components/NotificationChannelForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useProject } from '@/hooks/useProjects';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/projects/$projectId/notifications')({
	component: NotificationSettingsPage,
});

type ChannelType = 'email' | 'slack' | 'discord' | 'telegram' | 'webhook';

const channelTypeLabels: Record<ChannelType, string> = {
	email: 'Email',
	slack: 'Slack',
	discord: 'Discord',
	telegram: 'Telegram',
	webhook: 'Webhook',
};

function channelConfigSummary(type: string, config: Record<string, unknown>): string {
	switch (type) {
		case 'email': {
			const r = config.recipients as string[] | undefined;
			return r ? `${r.length} recipient${r.length === 1 ? '' : 's'}` : 'No recipients';
		}
		case 'slack':
		case 'discord': {
			const u = config.webhookUrl as string | undefined;
			return u ? `${u.substring(0, 40)}...` : 'No URL';
		}
		case 'telegram':
			return `Chat: ${(config.chatId as string) ?? 'unknown'}`;
		case 'webhook': {
			const u = config.url as string | undefined;
			return u ? `${u.substring(0, 40)}...` : 'No URL';
		}
		default:
			return '';
	}
}

function ToggleSwitch({
	label,
	checked,
	onChange,
	disabled,
}: {
	label: string;
	checked: boolean;
	onChange: (val: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-label={label}
			aria-checked={checked}
			disabled={disabled}
			onClick={() => !disabled && onChange(!checked)}
			className={cn(
				'relative h-6 w-11 shrink-0 rounded-full border-0 transition-colors',
				checked ? 'bg-foreground' : 'bg-gray-300',
				disabled && 'opacity-50 cursor-not-allowed',
			)}
		>
			<div
				className={cn(
					'absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-[left]',
					checked ? 'left-[23px]' : 'left-[3px]',
				)}
			/>
		</button>
	);
}

function SecretRevealDialog({ secret, onClose }: { secret: string; onClose: () => void }) {
	const [copied, setCopied] = useState(false);
	const handleCopy = async () => {
		await navigator.clipboard.writeText(secret);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Webhook HMAC Secret</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 p-1">
					<p className="text-sm text-muted">
						This secret will only be shown once. Copy it now and store it securely. Use it to verify
						incoming webhook payloads by computing an HMAC-SHA256 signature.
					</p>
					<div className="flex items-center gap-2 rounded-md border bg-accent p-3">
						<code className="flex-1 break-all font-mono text-xs">{secret}</code>
						<Button
							variant="outline"
							size="sm"
							className="h-7 shrink-0 text-xs"
							onClick={handleCopy}
						>
							{copied ? (
								<>
									<Check className="mr-1 h-3 w-3" />
									Copied
								</>
							) : (
								<>
									<Copy className="mr-1 h-3 w-3" />
									Copy
								</>
							)}
						</Button>
					</div>
					<div className="flex justify-end">
						<Button onClick={onClose}>Done</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function NotificationSettingsPage() {
	const { projectId } = Route.useParams();
	const { data: project, isPending: projectPending, error: projectError } = useProject(projectId);
	const { data: channels, isPending: channelsPending } = trpc.notification.list.useQuery(
		{ projectId },
		{ enabled: !!project },
	);
	const { data: doubleOptInData } = trpc.notification.getDoubleOptIn.useQuery(
		{ projectId },
		{ enabled: !!project },
	);
	const { data: confirmationEmailData } = trpc.notification.getSendConfirmationEmail.useQuery(
		{ projectId },
		{ enabled: !!project },
	);

	const [addingType, setAddingType] = useState<ChannelType | null>(null);
	const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
	const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

	const utils = trpc.useUtils();

	const createChannel = trpc.notification.create.useMutation({
		onSuccess: (data) => {
			toast.success('Channel created');
			utils.notification.list.invalidate({ projectId });
			setAddingType(null);
			if (data.type === 'webhook' && data.config) {
				const config = data.config as Record<string, unknown>;
				if (typeof config.secret === 'string') setRevealedSecret(config.secret);
			}
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to create channel');
		},
	});

	const updateChannel = trpc.notification.update.useMutation({
		onSuccess: () => {
			toast.success('Channel updated');
			utils.notification.list.invalidate({ projectId });
			setEditingChannelId(null);
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to update channel');
		},
	});

	const deleteChannel = trpc.notification.delete.useMutation({
		onSuccess: () => {
			toast.success('Channel deleted');
			utils.notification.list.invalidate({ projectId });
			setDeleteConfirmId(null);
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to delete channel');
		},
	});

	const regenerateSecret = trpc.notification.regenerateSecret.useMutation({
		onSuccess: (data) => {
			setRevealedSecret(data.secret);
			utils.notification.list.invalidate({ projectId });
		},
		onError: () => {
			toast.error('Failed to regenerate secret');
		},
	});

	const toggleDoubleOptIn = trpc.notification.toggleDoubleOptIn.useMutation({
		onSuccess: () => {
			toast.success('Email verification setting saved');
			utils.notification.getDoubleOptIn.invalidate({ projectId });
		},
		onError: () => {
			toast.error('Failed to save email verification setting');
		},
	});

	const toggleConfirmationEmail = trpc.notification.toggleSendConfirmationEmail.useMutation({
		onSuccess: () => {
			toast.success('Confirmation email setting saved');
			utils.notification.getSendConfirmationEmail.invalidate({ projectId });
		},
		onError: () => {
			toast.error('Failed to save confirmation email setting');
		},
	});

	const handleToggleEnabled = (channelId: string, enabled: boolean) => {
		updateChannel.mutate({ projectId, channelId, enabled });
	};
	const handleDoubleOptInToggle = (enabled: boolean) => {
		toggleDoubleOptIn.mutate({ projectId, enabled });
	};
	const handleConfirmationEmailToggle = (enabled: boolean) => {
		toggleConfirmationEmail.mutate({ projectId, enabled });
	};

	const deleteTarget = channels?.find((ch) => ch.id === deleteConfirmId);

	if (projectPending) {
		return (
			<div className="py-16 text-center">
				<p className="text-muted">Loading...</p>
			</div>
		);
	}

	if (projectError || !project) {
		return (
			<div className="settings-sections mx-auto max-w-4xl">
				<div className="mb-4">
					<Link to="/" className="text-sm text-muted hover:text-foreground">
						&larr; Back to dashboard
					</Link>
				</div>
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
					Failed to load project. Please try again.
				</div>
			</div>
		);
	}

	return (
		<div className="settings-sections mx-auto max-w-4xl">
			{/* Back link */}
			<div className="mb-6">
				<Link
					to="/projects/$projectId"
					params={{ projectId }}
					className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to project
				</Link>
			</div>

			<h1 className="mb-1 text-xl font-semibold text-foreground">Notification Settings</h1>
			<p className="mb-6 text-sm text-muted-foreground">
				Configure how you get notified when someone submits.
			</p>

			{/* Email Verification section */}
			<div className="mb-8">
				<h2 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
					Email Verification
				</h2>
				<div className="flex items-center justify-between gap-5 border-t border-border/50 pt-5">
					<div>
						<div className="text-sm font-medium">Require email verification</div>
						<div className="text-xs text-muted-foreground">
							Submissions require email confirmation before becoming active entries
						</div>
					</div>
					<ToggleSwitch
						label="Require email verification"
						checked={doubleOptInData?.doubleOptIn ?? false}
						onChange={handleDoubleOptInToggle}
						disabled={toggleDoubleOptIn.isPending}
					/>
				</div>
			</div>

			{/* Confirmation Email section */}
			<div className="mb-8">
				<h2 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
					Confirmation Email
				</h2>
				<div className="flex items-center justify-between gap-5 border-t border-border/50 pt-5">
					<div>
						<div className="text-sm font-medium">Send confirmation email</div>
						<div className="text-xs text-muted-foreground">
							Automatically send a welcome email when someone joins your waitlist
						</div>
					</div>
					<ToggleSwitch
						label="Send confirmation email"
						checked={confirmationEmailData?.sendConfirmationEmail ?? false}
						onChange={handleConfirmationEmailToggle}
						disabled={toggleConfirmationEmail.isPending}
					/>
				</div>
			</div>

			{/* Notification Channels section */}
			<div className="mb-8">
				<div className="mb-2 flex items-center justify-between">
					<h2 className="text-[11px] uppercase tracking-wider text-muted-foreground">Channels</h2>
					{!addingType && (
						<select
							aria-label="Add notification channel"
							value=""
							onChange={(e) => {
								if (e.target.value) setAddingType(e.target.value as ChannelType);
							}}
							className="h-7 rounded-md border border-border/50 bg-transparent px-2 text-xs text-muted hover:text-foreground"
						>
							<option value="" disabled>
								+ Add channel
							</option>
							<option value="email">Email</option>
							<option value="slack">Slack</option>
							<option value="discord">Discord</option>
							<option value="telegram">Telegram</option>
							<option value="webhook">Webhook</option>
						</select>
					)}
				</div>

				{/* Add channel form — shown in a Dialog */}
				<Dialog open={!!addingType} onOpenChange={(open) => !open && setAddingType(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								Add {addingType ? channelTypeLabels[addingType] : ''} Channel
							</DialogTitle>
						</DialogHeader>
						{addingType && (
							<NotificationChannelForm
								type={addingType}
								onSubmit={(config) => {
									createChannel.mutate({ projectId, type: addingType, config });
								}}
								onCancel={() => setAddingType(null)}
								isLoading={createChannel.isPending}
							/>
						)}
					</DialogContent>
				</Dialog>

				{/* Edit channel — shown in a Dialog */}
				<Dialog
					open={!!editingChannelId}
					onOpenChange={(open) => !open && setEditingChannelId(null)}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Edit Channel</DialogTitle>
						</DialogHeader>
						{editingChannelId &&
							(() => {
								const editChannel = channels?.find((ch) => ch.id === editingChannelId);
								if (!editChannel) return null;
								return (
									<NotificationChannelForm
										type={editChannel.type as ChannelType}
										initialConfig={editChannel.config}
										onSubmit={(config) => {
											updateChannel.mutate({ projectId, channelId: editingChannelId, config });
										}}
										onCancel={() => setEditingChannelId(null)}
										isLoading={updateChannel.isPending}
									/>
								);
							})()}
					</DialogContent>
				</Dialog>

				<div className="border-t border-border/50">
					{channelsPending && <p className="py-4 text-sm text-muted">Loading channels...</p>}

					{channels && channels.length === 0 && !addingType && (
						<p className="py-8 text-center text-sm text-muted-foreground">
							No notification channels configured. Add a channel to get notified about submissions.
						</p>
					)}

					{channels &&
						channels.length > 0 &&
						channels.map((channel) => (
							<div
								key={channel.id}
								className="flex flex-col gap-2 border-b border-border/50 py-2.5 md:flex-row md:items-center md:justify-between"
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span
											className={cn(
												'text-sm font-medium',
												!channel.enabled && 'text-muted-foreground',
											)}
										>
											{channelTypeLabels[channel.type as ChannelType] ?? channel.type}
										</span>
										{!channel.enabled && (
											<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
												Off
											</Badge>
										)}
									</div>
									<div className="mt-0.5 truncate text-xs text-muted-foreground">
										{channelConfigSummary(channel.type, channel.config)}
									</div>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									{channel.type === 'webhook' && (
										<button
											type="button"
											className="rounded px-2 py-0.5 text-xs text-muted hover:bg-accent hover:text-foreground"
											disabled={regenerateSecret.isPending}
											onClick={() => regenerateSecret.mutate({ projectId, channelId: channel.id })}
										>
											Regenerate
										</button>
									)}
									<button
										type="button"
										className="rounded px-2 py-0.5 text-xs text-muted hover:bg-accent hover:text-foreground"
										onClick={() => setEditingChannelId(channel.id)}
									>
										Edit
									</button>
									<ToggleSwitch
										label={`Enable ${channelTypeLabels[channel.type]} notifications`}
										checked={channel.enabled}
										onChange={(val) => handleToggleEnabled(channel.id, val)}
										disabled={updateChannel.isPending}
									/>
									<button
										type="button"
										className="rounded px-2 py-0.5 text-xs text-destructive hover:bg-red-50"
										onClick={() => setDeleteConfirmId(channel.id)}
									>
										Delete
									</button>
								</div>
							</div>
						))}
				</div>
			</div>

			{/* Delete confirmation dialog */}
			<Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Delete Channel</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this{' '}
							{deleteTarget ? channelTypeLabels[deleteTarget.type as ChannelType] : ''} channel?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							disabled={deleteChannel.isPending}
							onClick={() =>
								deleteConfirmId && deleteChannel.mutate({ projectId, channelId: deleteConfirmId })
							}
						>
							{deleteChannel.isPending ? 'Deleting...' : 'Delete'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{revealedSecret && (
				<SecretRevealDialog secret={revealedSecret} onClose={() => setRevealedSecret(null)} />
			)}
		</div>
	);
}
