// ABOUTME: Root layout with auth guard, 404 handling, and sidebar/centered layout switching.
// ABOUTME: Auth pages (login/signup) render without sidebar; all other routes get the AppLayout wrapper.

import {
	createRootRoute,
	isRedirect,
	Outlet,
	redirect,
	useMatchRoute,
} from '@tanstack/react-router';
import { AuthLayout } from '@/components/AuthLayout';
import { NotFoundContent } from '@/components/NotFoundContent';
import { Toaster } from '@/components/ui/sonner';
import { authClient } from '@/lib/auth-client';
import { identify } from '@/lib/tracking';
import { AppLayout } from '../components/AppLayout';

const AUTH_PATHS = ['/login', '/signup', '/verify-email'];

export const Route = createRootRoute({
	beforeLoad: async ({ location }) => {
		if (AUTH_PATHS.some((p) => location.pathname.startsWith(p))) {
			return;
		}

		try {
			const session = await authClient.getSession();
			if (!session?.data?.user) {
				throw redirect({ to: '/login' });
			}
			identify(session.data.user.id, { email: session.data.user.email });
		} catch (error) {
			// Re-throw TanStack Router redirects (they use throw for control flow)
			if (isRedirect(error)) {
				throw error;
			}
			// Network errors, rate limits, etc. — fail closed, send to login
			throw redirect({ to: '/login' });
		}
	},
	notFoundComponent: NotFoundContent,
	component: RootLayout,
});

function RootLayout() {
	const matchRoute = useMatchRoute();
	const isAuthPage = AUTH_PATHS.some((path) => matchRoute({ to: path }));

	if (isAuthPage) {
		return (
			<AuthLayout>
				<Outlet />
				<Toaster />
			</AuthLayout>
		);
	}

	return (
		<AppLayout>
			<Outlet />
			<Toaster />
		</AppLayout>
	);
}
