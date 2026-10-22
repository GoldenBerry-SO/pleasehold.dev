// ABOUTME: Dashboard card component displaying a project summary at a glance.
// ABOUTME: Shows project name, mode badge, brand color accent, logo thumbnail, and last activity.

import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface ProjectCardProps {
	id: string;
	name: string;
	mode: 'waitlist' | 'demo-booking';
	createdAt: Date;
	updatedAt: Date;
	brandColor?: string | null;
	logoUrl?: string | null;
	entryCount?: number;
}

function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - new Date(date).getTime();
	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMinutes < 1) return 'Just now';
	if (diffMinutes < 60) return `${diffMinutes}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 30) return `${diffDays}d ago`;
	return new Date(date).toLocaleDateString();
}

export function ProjectCard({
	id,
	name,
	mode,
	createdAt,
	updatedAt,
	brandColor,
	logoUrl,
	entryCount,
}: ProjectCardProps) {
	const accentColor = brandColor ?? (mode === 'waitlist' ? '#398567' : '#8671a0');

	return (
		<Link
			to="/projects/$projectId"
			params={{ projectId: id }}
			className="group block min-w-0 no-underline"
		>
			<Card className="project-card gap-0 overflow-hidden p-0">
				<div className="p-6">
					<div className="mb-6 flex items-center justify-between gap-3">
						<div
							className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background"
							style={{ color: accentColor }}
						>
							{logoUrl ? (
								<img src={logoUrl} alt="" className="h-8 w-8 rounded-md object-contain" />
							) : (
								<Layers className="h-5 w-5" />
							)}
						</div>
						<Badge variant="secondary" className="text-[10px] font-normal">
							{mode === 'demo-booking' ? 'Demo requests' : 'Waitlist'}
						</Badge>
					</div>
					<h2 className="truncate text-lg font-semibold">{name}</h2>
					<p className="mt-2 text-xs text-muted">
						Created{' '}
						{new Date(createdAt).toLocaleDateString(undefined, {
							month: 'short',
							day: 'numeric',
							year: 'numeric',
						})}
					</p>
					<div className="mt-7 flex items-end justify-between">
						<p>
							<span className="font-heading text-4xl font-medium tracking-tighter">
								{entryCount?.toLocaleString() ?? '—'}
							</span>
							<span className="ml-2 text-xs text-muted">
								{mode === 'demo-booking' ? 'requests' : 'entries'}
							</span>
						</p>
						<ArrowUpRight className="mb-1 h-5 w-5 text-muted transition-colors group-hover:text-primary" />
					</div>
				</div>
				<div className="flex items-center gap-2 border-t bg-background/60 px-6 py-3 text-[10px] text-muted">
					<span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
					Updated {formatRelativeTime(updatedAt)}
				</div>
			</Card>
		</Link>
	);
}
