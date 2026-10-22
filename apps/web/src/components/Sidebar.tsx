// ABOUTME: Forest-green workspace navigation matching the Please Hold public site.
// ABOUTME: Shows workspace name, nav links with Lucide icons, project list, and user dropdown.

import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { CreditCard, LayoutGrid, LogOut, Plus, Settings } from 'lucide-react';
import { PauseLogo } from '@/components/PauseLogo';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProjects } from '@/hooks/useProjects';
import { authClient } from '@/lib/auth-client';
import { reset as resetTracking } from '@/lib/tracking';
import { cn } from '@/lib/utils';

interface SidebarProps {
	onClose?: () => void;
	onCreateProject?: () => void;
	onOpenSettings?: (tab?: 'profile' | 'billing') => void;
}

export function Sidebar({ onClose, onCreateProject, onOpenSettings }: SidebarProps) {
	const { data: session } = authClient.useSession();
	const { data: projects } = useProjects();
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();

	const handleLogout = async () => {
		resetTracking();
		await authClient.signOut();
		navigate({ to: '/login' });
	};

	const isActive = (path: string, params?: Record<string, string>) => {
		return !!matchRoute({ to: path, params, fuzzy: true });
	};

	return (
		<aside className="workspace-sidebar flex h-dvh w-60 flex-col border-r border-sidebar-border bg-sidebar">
			{/* Workspace header */}
			<div className="px-5 pb-7 pt-8">
				<Link
					to="/"
					onClick={() => onClose?.()}
					className="sidebar-brand flex items-center gap-2.5 no-underline"
				>
					<PauseLogo size={30} />
					pleasehold
				</Link>
			</div>

			<Separator />

			{/* Primary nav */}
			<nav className="flex-1 overflow-y-auto px-3 py-5">
				<div className="space-y-0.5">
					<Link
						to="/"
						onClick={() => onClose?.()}
						className={cn(
							'sidebar-link flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm no-underline transition-colors',
							isActive('/', {}) && !isActive('/projects/$projectId', { projectId: '' })
								? 'bg-accent font-medium text-foreground'
								: 'text-muted hover:bg-accent hover:text-foreground',
						)}
					>
						<LayoutGrid className="h-4 w-4" />
						Projects
					</Link>
				</div>

				{/* Project list */}
				{projects && projects.length > 0 && (
					<div className="mt-8">
						<div className="mb-1 flex items-center justify-between px-2.5">
							<span className="font-mono text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
								Your Projects
							</span>
							<TooltipProvider delayDuration={200}>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											onClick={() => {
												onClose?.();
												onCreateProject?.();
											}}
											aria-label="New project"
											className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
										>
											<Plus className="h-3.5 w-3.5" />
										</button>
									</TooltipTrigger>
									<TooltipContent side="right">
										<p>New project</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						<div className="space-y-0.5">
							{projects.map((project) => (
								<Link
									key={project.id}
									to="/projects/$projectId"
									params={{ projectId: project.id }}
									onClick={() => onClose?.()}
									className={cn(
										'sidebar-link flex items-center gap-2.5 truncate rounded-md px-2.5 py-1.5 text-sm no-underline transition-colors',
										isActive('/projects/$projectId', { projectId: project.id })
											? 'bg-accent font-medium text-foreground'
											: 'text-muted hover:bg-accent hover:text-foreground',
									)}
								>
									<span
										className="h-2 w-2 flex-shrink-0 rounded-full"
										style={{
											backgroundColor:
												project.brandColor ?? (project.mode === 'waitlist' ? '#3b82f6' : '#8b5cf6'),
										}}
									/>
									<span className="truncate">{project.name}</span>
								</Link>
							))}
						</div>
					</div>
				)}
			</nav>

			<div className="mx-5 mb-5 rounded-lg border border-white/10 bg-white/[.03] p-4">
				<p className="mb-2 font-mono text-[9px] tracking-widest text-[#9dbba5]">
					BUILT FOR YOUR STACK
				</p>
				<a href="/docs" className="text-xs text-[#d4ebd8] hover:underline">
					Explore the API docs ↗
				</a>
			</div>
			<Separator />

			{/* User section */}
			{session?.user && (
				<div className="px-3 py-4">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent"
							>
								<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#b6efce] text-xs font-medium text-[#082d29]">
									{(session.user.name?.[0] ?? session.user.email[0]).toUpperCase()}
								</div>
								<span className="min-w-0 truncate text-sm text-muted">{session.user.email}</span>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent side="top" align="start" className="w-48">
							<DropdownMenuItem
								onClick={() => {
									onClose?.();
									onOpenSettings?.('profile');
								}}
							>
								<Settings className="mr-2 h-4 w-4" />
								Settings
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									onClose?.();
									onOpenSettings?.('billing');
								}}
							>
								<CreditCard className="mr-2 h-4 w-4" />
								Billing
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onClick={handleLogout}>
								<LogOut className="mr-2 h-4 w-4" />
								Sign out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			)}
		</aside>
	);
}
