// ABOUTME: Post-signup page prompting users to check their email for a verification link.
// ABOUTME: Includes a resend button and back-to-login link, styled to match the auth page layout.

import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export const Route = createFileRoute('/verify-email')({
	validateSearch: (search: Record<string, unknown>) => ({
		email: typeof search.email === 'string' ? search.email : '',
	}),
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	const { email } = useSearch({ from: '/verify-email' });
	const [resending, setResending] = useState(false);

	const handleResend = async () => {
		if (!email) {
			toast.error('No email address available. Please sign up again.');
			return;
		}

		setResending(true);
		try {
			await authClient.sendVerificationEmail({ email });
			toast.success('Verification email sent! Check your inbox.');
		} catch {
			toast.error('Failed to resend. Please try again.');
		} finally {
			setResending(false);
		}
	};

	return (
		<div className="w-full">
			<div className="flex flex-col items-center text-center">
				<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
					<MailCheck className="h-6 w-6 text-primary" />
				</div>

				<h1 className="mb-3">Check your email.</h1>
				<p className="mb-6 text-sm text-muted">
					{email ? (
						<>
							We sent a verification link to{' '}
							<span className="break-all font-medium text-foreground">{email}</span>. Click the link
							to activate your account.
						</>
					) : (
						<>We sent a verification link to your email. Click the link to activate your account.</>
					)}
				</p>

				<Button
					variant="outline"
					className="mb-4 w-full"
					disabled={resending || !email}
					onClick={handleResend}
				>
					{resending ? 'Sending...' : 'Resend verification email'}
				</Button>

				<Link to="/login" className="text-sm font-medium text-primary hover:underline">
					Back to login
				</Link>
			</div>
		</div>
	);
}
