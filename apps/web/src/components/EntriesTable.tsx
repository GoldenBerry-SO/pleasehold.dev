// ABOUTME: Headless TanStack Table wrapper for entry data with column definitions and pagination controls.
// ABOUTME: Uses manual pagination mode with entry UUID row IDs to prevent stale selection across page changes.

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type RowSelectionState,
	useReactTable,
	type VisibilityState,
} from '@tanstack/react-table';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { useIsMobile } from '@/hooks/useIsMobile';
import { EntryStatusBadge } from './EntryStatusBadge';

interface Entry {
	id: string;
	email: string;
	name: string | null;
	status: string;
	position: number;
	createdAt: Date;
}

interface EntriesTableProps {
	data: Entry[];
	total: number;
	page: number;
	pageSize: number;
	onPageChange: (page: number) => void;
	rowSelection: RowSelectionState;
	onRowSelectionChange: React.Dispatch<React.SetStateAction<RowSelectionState>>;
	onEntryClick: (entryId: string) => void;
}

const columns: ColumnDef<Entry, unknown>[] = [
	{
		id: 'select',
		header: ({ table }) => (
			<input
				type="checkbox"
				aria-label="Select all entries on this page"
				checked={table.getIsAllPageRowsSelected()}
				onChange={table.getToggleAllPageRowsSelectedHandler()}
				className="h-4 w-4 rounded border-input accent-primary"
			/>
		),
		cell: ({ row }) => (
			<input
				type="checkbox"
				aria-label={`Select ${row.original.email}`}
				checked={row.getIsSelected()}
				onChange={row.getToggleSelectedHandler()}
				className="h-4 w-4 rounded border-input accent-primary"
			/>
		),
		size: 32,
	},
	{
		accessorKey: 'email',
		header: 'Email',
		cell: ({ getValue }) => (
			<span className="font-medium text-foreground">{getValue() as string}</span>
		),
	},
	{
		accessorKey: 'name',
		header: 'Name',
		cell: ({ getValue }) => {
			const value = getValue() as string | null;
			return <span className="text-muted">{value ?? '\u2014'}</span>;
		},
	},
	{
		accessorKey: 'status',
		header: 'Status',
		cell: ({ getValue }) => <EntryStatusBadge status={getValue() as string} />,
	},
	{
		accessorKey: 'position',
		header: '#',
		cell: ({ getValue }) => <span className="text-muted">{getValue() as number}</span>,
	},
	{
		accessorKey: 'createdAt',
		header: 'Submitted',
		cell: ({ getValue }) => {
			const value = getValue() as Date | string;
			const date = value instanceof Date ? value : new Date(value);
			return <span className="text-muted">{date.toLocaleDateString()}</span>;
		},
	},
];

export function EntriesTable({
	data,
	total,
	page,
	pageSize,
	onPageChange,
	rowSelection,
	onRowSelectionChange,
	onEntryClick,
}: EntriesTableProps) {
	const totalPages = Math.ceil(total / pageSize);
	const isMobile = useIsMobile();

	const columnVisibility: VisibilityState = isMobile
		? { name: false, position: false, createdAt: false }
		: {};

	const table = useReactTable({
		data,
		columns,
		pageCount: totalPages,
		state: {
			rowSelection,
			pagination: { pageIndex: page - 1, pageSize },
			columnVisibility,
		},
		onRowSelectionChange,
		manualPagination: true,
		getCoreRowModel: getCoreRowModel(),
		enableRowSelection: true,
		getRowId: (row) => row.id,
	});

	const startEntry = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const endEntry = Math.min(page * pageSize, total);

	return (
		<div>
			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead key={header.id}>
									{header.isPlaceholder
										? null
										: flexRender(header.column.columnDef.header, header.getContext())}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={table.getVisibleLeafColumns().length}
								className="py-8 text-center text-muted-foreground"
							>
								No entries found
							</TableCell>
						</TableRow>
					) : (
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={row.id}
								className="cursor-pointer"
								onClick={(e) => {
									const target = e.target as HTMLElement;
									if (
										target.tagName === 'INPUT' &&
										(target as HTMLInputElement).type === 'checkbox'
									) {
										return;
									}
									onEntryClick(row.original.id);
								}}
							>
								{row.getVisibleCells().map((cell) => (
									<TableCell key={cell.id}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>

			{/* Pagination controls */}
			<div className="flex items-center justify-between px-2 py-2 text-xs text-muted">
				<span>
					{startEntry}–{endEntry} of {total}
				</span>
				<div className="flex items-center gap-1">
					<button
						type="button"
						className="rounded px-3 py-1.5 text-xs text-muted hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
						disabled={page <= 1}
						onClick={() => onPageChange(page - 1)}
					>
						Previous
					</button>
					<span className="px-1">
						{page}/{totalPages || 1}
					</span>
					<button
						type="button"
						className="rounded px-3 py-1.5 text-xs text-muted hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
						disabled={page >= totalPages}
						onClick={() => onPageChange(page + 1)}
					>
						Next
					</button>
				</div>
			</div>
		</div>
	);
}
