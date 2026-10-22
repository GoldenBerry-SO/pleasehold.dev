// ABOUTME: Signup page with name/email/password form and OAuth social login buttons.
// ABOUTME: Creates a new account via Better Auth client and redirects to dashboard on success.

import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/lib/auth-client';
import { type SignupValues, signupSchema } from '@/lib/schemas';
import { capture } from '@/lib/tracking';

export const Route = createFileRoute('/signup')({
	component: SignupPage,
});

/** Map Better Auth error messages to user-friendly text. Sensitive errors
 *  (e.g. "user already exists") stay generic to prevent user enumeration. */
function signupErrorMessage(code: string | undefined): string {
	const fallback = 'Unable to create account. Please try again.';
	if (!code) return fallback;

	const safeMessages: Record<string, string> = {
		'Password too short': 'Password must be at least 10 characters.',
		'Password too long': 'Password is too long. Maximum 128 characters.',
		'Invalid email': 'Please enter a valid email address.',
		'Invalid password': 'Password is invalid.',
	};

	return safeMessages[code] ?? fallback;
}

function SignupPage() {
	const [oauthLoading, setOauthLoading] = useState<string | null>(null);

	const form = useForm<SignupValues>({
		resolver: zodResolver(signupSchema),
		defaultValues: { name: '', email: '', password: '' },
	});

	const onSubmit = async (values: SignupValues) => {
		try {
			const result = await authClient.signUp.email(values);
			if (result.error) {
				toast.error(signupErrorMessage(result.error.message));
			} else {
				capture('user_signed_up', { method: 'email' });
				window.location.href = `/verify-email?email=${encodeURIComponent(values.email)}`;
			}
		} catch {
			toast.error('An unexpected error occurred. Please try again.');
		}
	};

	const handleOAuth = async (provider: 'github' | 'google') => {
		setOauthLoading(provider);
		const label = provider === 'github' ? 'GitHub' : 'Google';

		try {
			capture('user_signed_up_oauth', { provider });
			const result = await authClient.signIn.social({ provider, callbackURL: '/' });
			if (result.error) {
				toast.error(`Failed to sign in with ${label}. Please try again.`);
				setOauthLoading(null);
			}
		} catch {
			toast.error(`Failed to sign in with ${label}. Please try again.`);
			setOauthLoading(null);
		}
	};

	const anyLoading = form.formState.isSubmitting || oauthLoading !== null;

	return (
		<div className="w-full">
			<p className="workspace-kicker">YOUR NEXT CHAPTER</p>
			<h1 className="mb-3">Make room for your first users.</h1>
			<p className="mb-8 text-sm leading-relaxed text-muted">
				Start free with 100 entries a month. No credit card required.
			</p>

			<div className="mb-6 flex flex-col gap-3">
				<Button
					type="button"
					variant="outline"
					className="w-full gap-2"
					disabled={anyLoading}
					onClick={() => handleOAuth('github')}
				>
					<GitHubIcon />
					{oauthLoading === 'github' ? 'Redirecting...' : 'Continue with GitHub'}
				</Button>
				{/* Google OAuth disabled until credentials are configured */}
			</div>

			<div className="relative mb-6">
				<Separator />
				<span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
					or
				</span>
			</div>

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)}>
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem className="mb-4">
								<FormLabel>Name</FormLabel>
								<FormControl>
									<Input type="text" autoComplete="name" placeholder="Your name" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem className="mb-4">
								<FormLabel>Email</FormLabel>
								<FormControl>
									<Input
										type="email"
										autoComplete="email"
										placeholder="you@company.com"
										{...field}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem className="mb-6">
								<FormLabel>Password</FormLabel>
								<FormControl>
									<Input type="password" autoComplete="new-password" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button type="submit" className="w-full" disabled={anyLoading}>
						{form.formState.isSubmitting ? 'Creating account...' : 'Create account'}
					</Button>
				</form>
			</Form>

			<p className="mt-6 text-center text-sm text-muted">
				Already have an account?{' '}
				<Link to="/login" className="font-medium text-primary hover:underline">
					Log in
				</Link>
			</p>
		</div>
	);
}

function GitHubIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
			<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
		</svg>
	);
}

function GoogleIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
			<path
				d="M15.68 8.18c0-.57-.05-1.11-.15-1.64H8v3.1h4.31a3.68 3.68 0 01-1.6 2.42v2.01h2.59c1.51-1.39 2.38-3.44 2.38-5.89z"
				fill="#4285F4"
			/>
			<path
				d="M8 16c2.16 0 3.97-.72 5.3-1.94l-2.59-2.01c-.72.48-1.63.76-2.71.76-2.09 0-3.86-1.41-4.49-3.31H.84v2.07A7.99 7.99 0 008 16z"
				fill="#34A853"
			/>
			<path
				d="M3.51 9.5a4.81 4.81 0 010-3.01V4.42H.84A7.99 7.99 0 000 8c0 1.29.31 2.51.84 3.58l2.67-2.07z"
				fill="#FBBC05"
			/>
			<path
				d="M8 3.18c1.18 0 2.23.41 3.07 1.2l2.3-2.3A7.97 7.97 0 008 0 7.99 7.99 0 00.84 4.42l2.67 2.07C4.14 4.59 5.91 3.18 8 3.18z"
				fill="#EA4335"
			/>
		</svg>
	);
}
