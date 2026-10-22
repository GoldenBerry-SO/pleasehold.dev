// ABOUTME: Color-coded status indicator using a small dot and text label for entry statuses.
// ABOUTME: Uses subtle dot+text pattern instead of pill badges for Linear-style aesthetic.

import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
	new: 'bg-[#459779]',
	contacted: 'bg-[#cba451]',
	converted: 'bg-[#8d79aa]',
	archived: 'bg-[#a5b2a0]',
	pending_verification: 'bg-orange-400',
};

const statusTextColors: Record<string, string> = {
	new: 'text-[#34664c]',
	contacted: 'text-[#896c2b]',
	converted: 'text-[#77608c]',
	archived: 'text-muted',
	pending_verification: 'text-orange-600',
};

interface EntryStatusBadgeProps {
	status: string;
}

export function EntryStatusBadge({ status }: EntryStatusBadgeProps) {
	const dotColor = statusColors[status] ?? statusColors.archived;
	const textColor = statusTextColors[status] ?? statusTextColors.archived;
	const label =
		status === 'pending_verification'
			? 'Pending'
			: status.charAt(0).toUpperCase() + status.slice(1);

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 rounded-md border border-current/15 bg-current/5 px-2 py-1 text-[11px] font-medium',
				textColor,
			)}
		>
			<span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
			{label}
		</span>
	);
}
