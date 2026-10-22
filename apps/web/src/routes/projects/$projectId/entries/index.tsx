// ABOUTME: Entries management page at /projects/$projectId/entries with search, filter, pagination, and bulk actions.
// ABOUTME: Wires together EntriesTable, BulkActionBar, and CsvExportButton with tRPC data queries.

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { RowSelectionState } from '@tanstack/react-table';
import { ArrowLeft, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BulkActionBar } from '@/components/BulkActionBar';
import { CsvExportButton } from '@/components/CsvExportButton';
import { EmptyState } from '@/components/EmptyState';
import { EntriesTable } from '@/components/EntriesTable';
import { Input } from '@/components/ui/input';
import { capture } from '@/lib/tracking';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/projects/$projectId/entries/')({
	component: EntriesPage,
});

function EntriesPage() {
	const { projectId } = Route.useParams();
	const navigate = useNavigate();
	const utils = trpc.useUtils();

	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
	const [page, setPage] = useState(1);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	// Debounce search input at 300ms
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search);
		}, 300);
		return () => clearTimeout(timer);
	}, [search]);

	// Reset page to 1 when search or filter changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional triggers for resetting pagination
	useEffect(() => {
		setPage(1);
		setRowSelection({});
	}, [debouncedSearch, statusFilter]);

	const { data: project, isPending: projectPending } = trpc.project.getById.useQuery({
		id: projectId,
	});
	const {
		data: entriesData,
		isPending: entriesPending,
		error: entriesError,
	} = trpc.entry.list.useQuery({
		projectId,
		search: debouncedSearch || undefined,
		status:
			(statusFilter as 'new' | 'contacted' | 'converted' | 'archived' | 'pending_verification') ||
			undefined,
		page,
		pageSize: 25,
	});
	const { data: statsData } = trpc.entry.stats.useQuery({ projectId });

	const bulkMutation = trpc.entry.bulkUpdateStatus.useMutation({
		onSuccess: (_data, variables) => {
			capture('entry_bulk_status_updated', {
				projectId,
				count: variables.entryIds.length,
			});
			utils.entry.list.invalidate();
			utils.entry.stats.invalidate();
			setRowSelection({});
		},
	});

	const selectedEntryIds = Object.keys(rowSelection).filter((key) => rowSelection[key]);

	const isLoading = projectPending || entriesPending;

	if (isLoading) {
		return (
			<div className="py-16 text-center">
				<p className="text-muted">Loading entries...</p>
			</div>
		);
	}

	if (entriesError) {
		return (
			<div className="mx-auto max-w-4xl">
				<div className="mb-4">
					<Link
						to="/projects/$projectId"
						params={{ projectId }}
						className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						Back to project
					</Link>
				</div>
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
					Failed to load entries. Please try again.
				</div>
			</div>
		);
	}

	// Empty state when no entries at all
	if (statsData && statsData.total === 0 && !debouncedSearch && !statusFilter) {
		return (
			<div className="mx-auto max-w-4xl">
				<div className="mb-6">
					<Link
						to="/projects/$projectId"
						params={{ projectId }}
						className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						Back to project
					</Link>
				</div>
				<h1 className="mb-1 text-xl font-semibold text-foreground">Entries</h1>
				<p className="mb-6 text-sm text-muted-foreground">
					View, search, and manage all submissions for this project.
				</p>
				<EmptyState message="No entries yet. Entries will appear here once you start collecting submissions via the API." />
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl">
			{/* Breadcrumb */}
			<div className="mb-6">
				<Link
					to="/projects/$projectId"
					params={{ projectId }}
					className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to project
				</Link>
			</div>

			{/* Header with inline count */}
			<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-baseline gap-2">
					<h1 className="text-xl font-semibold text-foreground">Entries</h1>
					{statsData && <span className="text-sm text-muted">{statsData.total}</span>}
				</div>
				{project && <CsvExportButton projectId={projectId} projectName={project.name} />}
			</div>
			<p className="mb-7 text-sm text-muted">
				View, search, and manage all submissions for this project.
			</p>

			{/* Filter toolbar */}
			<div className="mb-4 flex flex-col gap-3 rounded-lg border bg-card p-3 md:flex-row md:items-center">
				<div className="relative flex-1">
					<Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="text"
						aria-label="Search entries"
						placeholder="Search by name or email..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-9 border-0 bg-transparent pl-8 text-sm shadow-none"
					/>
				</div>
				<select
					aria-label="Filter by status"
					value={statusFilter ?? ''}
					onChange={(e) => setStatusFilter(e.target.value || undefined)}
					className="h-9 rounded-md border bg-background px-3 text-xs text-muted hover:text-foreground"
				>
					<option value="">All statuses</option>
					<option value="new">New</option>
					<option value="contacted">Contacted</option>
					<option value="converted">Converted</option>
					<option value="archived">Archived</option>
					<option value="pending_verification">Pending Verification</option>
				</select>
			</div>

			{/* Bulk action bar */}
			<BulkActionBar
				selectedCount={selectedEntryIds.length}
				onStatusChange={(status) =>
					bulkMutation.mutate({
						projectId,
						entryIds: selectedEntryIds,
						status: status as 'new' | 'contacted' | 'converted' | 'archived',
					})
				}
				isPending={bulkMutation.isPending}
			/>

			{/* Entries table — flat, no Card wrapper */}
			<EntriesTable
				data={entriesData?.entries ?? []}
				total={entriesData?.total ?? 0}
				page={page}
				pageSize={25}
				onPageChange={setPage}
				rowSelection={rowSelection}
				onRowSelectionChange={setRowSelection}
				onEntryClick={(entryId) => {
					void navigate({
						to: '/projects/$projectId/entries/$entryId',
						params: { projectId, entryId },
					});
				}}
			/>
		</div>
	);
}
