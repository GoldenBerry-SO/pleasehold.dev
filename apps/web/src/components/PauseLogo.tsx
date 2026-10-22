// ABOUTME: Shared solid pause mark for the Please Hold product identity.
// ABOUTME: Inherits its tile color; the bars adapt to the surrounding brand surface.
import { cn } from '@/lib/utils';

interface PauseLogoProps {
	size?: number;
	className?: string;
}
export function PauseLogo({ size = 20, className }: PauseLogoProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 32 32"
			width={size}
			height={size}
			className={cn('shrink-0', className)}
			aria-hidden="true"
		>
			<rect width="32" height="32" rx="8" fill="currentColor" />
			<path
				d="M11 9v14M21 9v14"
				stroke="var(--pause-bars, #b6efce)"
				strokeWidth="3"
				strokeLinecap="round"
			/>
		</svg>
	);
}
