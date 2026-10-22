// ABOUTME: Dashboard index route showing project card grid or guided creation flow.
// ABOUTME: Auth is handled by root beforeLoad guard; shows CreateProjectFlow for zero-project users.

import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { CreateProjectFlow } from '@/components/CreateProjectFlow';
import { ProjectCard } from '@/components/ProjectCard';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useProjects } from '@/hooks/useProjects';
import { useBillingEnabled, useSubscription } from '@/hooks/useSubscription';

export const Route = createFileRoute('/')({
	component: DashboardIndex,
});

function DashboardIndex() {
	const { data: projects, isPending: projectsLoading, error } = useProjects();
	const { data: billing } = useBillingEnabled();
	const { data: sub } = useSubscription();
	const [createOpen, setCreateOpen] = useState(false);

	const canCreateProject =
		!billing?.enabled || sub?.plan === 'pro' || !projects || projects.length < 1;

	if (projectsLoading) {
		return (
			<div className="py-16 text-center">
				<p className="text-muted">Loading projects...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="mx-auto max-w-5xl">
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
					Failed to load projects. Please try refreshing the page.
				</div>
			</div>
		);
	}

	// First-time user with zero projects: show guided creation flow
	if (!projects || projects.length === 0) {
		return (
			<div className="py-8">
				<CreateProjectFlow />
			</div>
		);
	}

	// Returning user: show project card grid
	return (
		<div className="mx-auto max-w-5xl">
			<p className="workspace-kicker">YOUR WORKSPACE</p>
			<div className="mb-9 flex flex-wrap items-center justify-between gap-5">
				<div>
					<h1 className="text-xl font-semibold text-foreground">Projects</h1>
					<p className="mt-2 text-sm text-muted">
						A home for your next ideas and their first users.
					</p>
				</div>
				<TooltipProvider delayDuration={200}>
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									size="sm"
									className="h-10 text-xs"
									disabled={!canCreateProject}
									onClick={() => setCreateOpen(true)}
								>
									<Plus className="mr-1 h-3.5 w-3.5" />
									New Project
								</Button>
							</span>
						</TooltipTrigger>
						{!canCreateProject && (
							<TooltipContent>
								<p>Free plan allows 1 project. Upgrade to Pro for unlimited.</p>
							</TooltipContent>
						)}
					</Tooltip>
				</TooltipProvider>
			</div>

			<div className="mb-5 flex items-center justify-between border-b pb-4">
				<span className="font-mono text-[10px] uppercase tracking-widest text-muted">
					All projects{' '}
					<span className="ml-2 rounded bg-secondary px-2 py-1 text-secondary-foreground">
						{projects.length}
					</span>
				</span>
				<a href="/docs" className="text-xs text-primary hover:underline">
					API documentation ↗
				</a>
			</div>
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
				{projects.map((project) => (
					<ProjectCard
						key={project.id}
						id={project.id}
						name={project.name}
						mode={project.mode}
						createdAt={project.createdAt}
						updatedAt={project.updatedAt}
						brandColor={project.brandColor}
						logoUrl={project.logoUrl}
						entryCount={'entryCount' in project ? (project.entryCount as number) : undefined}
					/>
				))}
			</div>

			<CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
		</div>
	);
}
