// ABOUTME: Reusable empty state placeholder with the pause logo and a message.
// ABOUTME: Used across entries, API keys, and other list views when there's no data.

import { PauseLogo } from '@/components/PauseLogo';

interface EmptyStateProps {
	message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
			<PauseLogo size={48} className="mb-5 text-primary" />
			<p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{message}</p>
		</div>
	);
}
