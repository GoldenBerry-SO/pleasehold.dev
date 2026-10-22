// ABOUTME: Field configuration toggle form for project settings.
// ABOUTME: Displays email as always required and provides toggle switches for name, company, and message fields.

import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface FieldConfigFormProps {
	projectId: string;
	collectName: boolean;
	collectCompany: boolean;
	collectMessage: boolean;
}

function ToggleSwitch({
	checked,
	onChange,
	label,
	description,
}: {
	checked: boolean;
	onChange: (val: boolean) => void;
	label: string;
	description: string;
}) {
	return (
		<div className="flex items-center justify-between gap-4 border-b border-gray-100 py-3">
			<div>
				<div className="text-sm font-medium">{label}</div>
				<div className="text-xs text-muted-foreground">{description}</div>
			</div>
			<button
				type="button"
				role="switch"
				aria-label={`Collect ${label.toLowerCase()}`}
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				className={cn(
					'relative h-6 w-11 shrink-0 rounded-full border-0 transition-colors',
					checked ? 'bg-foreground' : 'bg-gray-300',
				)}
			>
				<div
					className={cn(
						'absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-[left]',
						checked ? 'left-[23px]' : 'left-[3px]',
					)}
				/>
			</button>
		</div>
	);
}

export function FieldConfigForm({
	projectId,
	collectName,
	collectCompany,
	collectMessage,
}: FieldConfigFormProps) {
	const [fields, setFields] = useState({
		collectName,
		collectCompany,
		collectMessage,
	});

	const utils = trpc.useUtils();
	const updateFields = trpc.project.updateFields.useMutation({
		onSuccess: () => {
			toast.success('Field configuration saved');
			utils.project.getById.invalidate({ id: projectId });
		},
		onError: () => {
			toast.error('Failed to save field configuration');
		},
	});

	const handleToggle = (field: keyof typeof fields, value: boolean) => {
		const updated = { ...fields, [field]: value };
		setFields(updated);
		updateFields.mutate({ projectId, ...updated });
	};

	return (
		<div>
			<h3 className="mb-4 text-base font-semibold">Field Configuration</h3>

			{/* Email is always required */}
			<div className="flex items-center justify-between gap-4 border-b border-gray-100 py-3">
				<div>
					<div className="text-sm font-medium">Email</div>
					<div className="text-xs text-muted-foreground">Primary contact field</div>
				</div>
				<span className="text-xs italic text-muted">Always required</span>
			</div>

			<ToggleSwitch
				checked={fields.collectName}
				onChange={(val) => handleToggle('collectName', val)}
				label="Name"
				description="Collect the submitter's name"
			/>
			<ToggleSwitch
				checked={fields.collectCompany}
				onChange={(val) => handleToggle('collectCompany', val)}
				label="Company"
				description="Collect company or organization name"
			/>
			<ToggleSwitch
				checked={fields.collectMessage}
				onChange={(val) => handleToggle('collectMessage', val)}
				label="Message"
				description="Allow a freeform message or note"
			/>
		</div>
	);
}
