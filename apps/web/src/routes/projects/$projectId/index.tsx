// ABOUTME: Project overview page showing stats graph cards, properties, and navigation links.
// ABOUTME: Fetches project by ID with ownership guard; displays Linear-style dashboard with SVG charts.

import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useProject } from '@/hooks/useProjects';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/projects/$projectId/')({
	component: ProjectOverviewPage,
});

const statusColors: Record<string, string> = {
	new: '#459779',
	contacted: '#cba451',
	converted: '#8d79aa',
	archived: '#a5b2a0',
};

const statusLabels: Record<string, string> = {
	new: 'New',
	contacted: 'Contacted',
	converted: 'Converted',
	archived: 'Archived',
};

function StatusDistributionBar({
	byStatus,
	total,
}: {
	byStatus: Record<string, number>;
	total: number;
}) {
	if (total === 0) {
		return (
			<div className="flex h-2 w-full overflow-hidden rounded-full bg-accent">
				<div className="h-full w-full bg-border/30" />
			</div>
		);
	}

	const statuses = ['new', 'contacted', 'converted', 'archived'];

	return (
		<div className="flex h-2 w-full overflow-hidden rounded-full">
			{statuses.map((status) => {
				const count = byStatus[status] ?? 0;
				const pct = (count / total) * 100;
				if (pct === 0) return null;
				return (
					<div
						key={status}
						className="h-full transition-all"
						style={{ width: `${pct}%`, backgroundColor: statusColors[status] }}
					/>
				);
			})}
		</div>
	);
}

function StatusDonutChart({
	byStatus,
	total,
}: {
	byStatus: Record<string, number>;
	total: number;
}) {
	const size = 80;
	const strokeWidth = 10;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const center = size / 2;

	if (total === 0) {
		return (
			<svg width={size} height={size} className="shrink-0" role="img" aria-label="No entries">
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					className="text-border/30"
				/>
			</svg>
		);
	}

	const statuses = ['new', 'contacted', 'converted', 'archived'];
	let offset = 0;

	return (
		<svg
			width={size}
			height={size}
			className="shrink-0 -rotate-90"
			role="img"
			aria-label="Entry status distribution"
		>
			{statuses.map((status) => {
				const count = byStatus[status] ?? 0;
				const pct = count / total;
				const dashLength = circumference * pct;
				const dashOffset = circumference * offset;
				offset += pct;
				if (pct === 0) return null;
				return (
					<circle
						key={status}
						cx={center}
						cy={center}
						r={radius}
						fill="none"
						stroke={statusColors[status]}
						strokeWidth={strokeWidth}
						strokeDasharray={`${dashLength} ${circumference - dashLength}`}
						strokeDashoffset={-dashOffset}
						strokeLinecap="butt"
					/>
				);
			})}
		</svg>
	);
}

function ProjectOverviewPage() {
	const { projectId } = Route.useParams();
	const { data: project, isPending, error } = useProject(projectId);
	const { data: apiKeys } = trpc.apiKey.list.useQuery({ projectId }, { enabled: !!project });
	const { data: stats } = trpc.entry.stats.useQuery({ projectId }, { enabled: !!project });
	const { data: notificationChannels } = trpc.notification.list.useQuery(
		{ projectId },
		{ enabled: !!project },
	);
	const activeKeyCount = apiKeys?.filter((k) => k.enabled).length ?? 0;
	const enabledChannelCount = notificationChannels?.filter((ch) => ch.enabled).length ?? 0;

	if (isPending) {
		return (
			<div className="py-16 text-center">
				<p className="text-muted">Loading project...</p>
			</div>
		);
	}

	if (error || !project) {
		return (
			<div className="mx-auto max-w-4xl">
				<div className="mb-4">
					<Link
						to="/"
						className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						Back to dashboard
					</Link>
				</div>
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
					{error?.message === 'Project not found'
						? 'Project not found. It may have been deleted or you may not have access.'
						: 'Failed to load project. Please try again.'}
				</div>
			</div>
		);
	}

	const collectedFields = ['Email'];
	if (project.fieldConfig?.collectName) collectedFields.push('Name');
	if (project.fieldConfig?.collectCompany) collectedFields.push('Company');
	if (project.fieldConfig?.collectMessage) collectedFields.push('Message');

	const byStatus = stats?.byStatus ?? {};
	const total = stats?.total ?? 0;

	return (
		<div className="mx-auto max-w-4xl">
			<p className="workspace-kicker">
				<Link to="/" className="hover:text-primary">
					Projects
				</Link>
				<span className="px-3 opacity-50">/</span>Overview
			</p>
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
					<Badge variant="secondary" className="gap-1.5 px-2 py-1 text-[10px] font-medium">
						<span
							className="h-1.5 w-1.5 rounded-full"
							style={{ backgroundColor: project.brandColor ?? '#398567' }}
						/>
						{project.mode === 'demo-booking' ? 'Demo requests' : 'Waitlist'}
					</Badge>
				</div>
				<Button variant="outline" size="sm" className="h-9 text-xs" asChild>
					<Link to="/projects/$projectId/settings" params={{ projectId }}>
						<Settings className="mr-1 h-3.5 w-3.5" />
						Settings
					</Link>
				</Button>
			</div>
			<p className="mb-8 text-sm text-muted">Your first users, all in one place.</p>

			{/* Graph cards row */}
			<div className="mb-9 grid grid-cols-1 gap-4 lg:grid-cols-3">
				{/* Total entries card with donut */}
				<Card className="gap-3 p-6">
					<div className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
						Total Entries
					</div>
					<div className="flex items-center gap-4">
						<StatusDonutChart byStatus={byStatus} total={total} />
						<div>
							<div className="text-3xl font-semibold text-foreground">{total}</div>
							<div className="mt-1 text-xs text-muted-foreground">
								{total === 1 ? 'entry' : 'entries'}
							</div>
						</div>
					</div>
				</Card>

				{/* Status breakdown card */}
				<Card className="gap-3 p-6">
					<div className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
						By Status
					</div>
					<div className="mb-3">
						<StatusDistributionBar byStatus={byStatus} total={total} />
					</div>
					<div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
						{(['new', 'contacted', 'converted', 'archived'] as const).map((status) => (
							<div key={status} className="flex items-center justify-between">
								<div className="flex items-center gap-1.5">
									<span
										className="h-2 w-2 rounded-full"
										style={{ backgroundColor: statusColors[status] }}
									/>
									<span className="text-xs text-muted-foreground">{statusLabels[status]}</span>
								</div>
								<span className="text-xs font-medium text-foreground">{byStatus[status] ?? 0}</span>
							</div>
						))}
					</div>
				</Card>

				{/* Quick stats card */}
				<Card className="gap-3 p-6">
					<div className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">
						Configuration
					</div>
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-xs text-muted-foreground">API Keys</span>
							<span className="text-sm font-medium text-foreground">{activeKeyCount}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs text-muted-foreground">Fields</span>
							<span className="text-sm font-medium text-foreground">{collectedFields.length}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs text-muted-foreground">Notifications</span>
							<span className="text-sm font-medium text-foreground">{enabledChannelCount}</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs text-muted-foreground">Created</span>
							<span className="text-xs text-foreground">
								{new Date(project.createdAt).toLocaleDateString()}
							</span>
						</div>
					</div>
				</Card>
			</div>

			{/* Navigation links */}
			<div>
				<h2 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
					Keep your launch moving
				</h2>
				<div className="project-tools">
					<Link
						to="/projects/$projectId/entries"
						params={{ projectId }}
						className="flex items-center justify-between border-b border-border/50 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-accent"
					>
						<span>
							Entries
							{total > 0 && <span className="ml-2 text-xs text-muted">{total}</span>}
						</span>
						<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
					</Link>
					<Link
						to="/projects/$projectId/emails"
						params={{ projectId }}
						className="flex items-center justify-between border-b border-border/50 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-accent"
					>
						<span>Email Templates</span>
						<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
					</Link>
					<Link
						to="/projects/$projectId/keys"
						params={{ projectId }}
						className="flex items-center justify-between border-b border-border/50 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-accent"
					>
						<span>
							API Keys
							{activeKeyCount > 0 && (
								<span className="ml-2 text-xs text-muted">{activeKeyCount}</span>
							)}
						</span>
						<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
					</Link>
					<Link
						to="/projects/$projectId/settings"
						params={{ projectId }}
						className="flex items-center justify-between border-b border-border/50 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-accent"
					>
						<span>Settings</span>
						<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
					</Link>
					<Link
						to="/projects/$projectId/notifications"
						params={{ projectId }}
						className="flex items-center justify-between border-b border-border/50 py-2.5 text-sm text-foreground no-underline transition-colors hover:bg-accent"
					>
						<span>
							Notifications
							{enabledChannelCount > 0 && (
								<span className="ml-2 text-xs text-muted">{enabledChannelCount}</span>
							)}
						</span>
						<ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
					</Link>
				</div>
			</div>
		</div>
	);
}
