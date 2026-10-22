// ABOUTME: Guided multi-step project creation flow for first-time users.
// ABOUTME: Step 1: name, Step 2: mode selection, Step 3: branding (optional), Step 4: review and create.

import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { type CreateProjectValues, createProjectSchema } from '@/lib/schemas';
import { capture } from '@/lib/tracking';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

type Mode = 'waitlist' | 'demo-booking';

const modeDescriptions: Record<Mode, { label: string; description: string; fields: string }> = {
	waitlist: {
		label: 'Waitlist',
		description: 'Collect email addresses for a simple waitlist or early access signup.',
		fields: 'Collects: Email only',
	},
	'demo-booking': {
		label: 'Demo Booking',
		description: 'Collect detailed contact information for demo requests or sales inquiries.',
		fields: 'Collects: Email, Name, Company, Message',
	},
};

const TOTAL_STEPS = 4;

export function CreateProjectFlow() {
	const navigate = useNavigate();
	const [step, setStep] = useState(1);
	const [logoFile, setLogoFile] = useState<File | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);

	const form = useForm<CreateProjectValues>({
		resolver: zodResolver(createProjectSchema),
		defaultValues: { name: '', mode: 'waitlist', companyName: '', brandColor: '#0d9488' },
	});

	const updateProject = trpc.project.update.useMutation();

	const createProject = trpc.project.create.useMutation({
		onSuccess: async (data) => {
			capture('project_created', { projectId: data.id, mode: form.getValues('mode') });
			// If a logo was staged, upload it and attach to the project
			if (logoFile) {
				try {
					await uploadLogo(data.id, logoFile);
				} catch {
					toast.error('Project created but logo upload failed. You can add it in settings.');
				}
			}
			toast.success('Project created');
			navigate({ to: '/projects/$projectId', params: { projectId: data.id } });
		},
		onError: (err) => {
			toast.error(err.message ?? 'Failed to create project. Please try again.');
		},
	});

	const uploadLogo = useCallback(
		async (projectId: string, file: File) => {
			setUploading(true);
			try {
				const res = await fetch('/api/upload/presign', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ contentType: file.type, fileName: file.name }),
				});

				if (!res.ok) {
					const err = await res.json();
					throw new Error(err.error ?? 'Upload failed');
				}

				const { uploadUrl, publicUrl } = await res.json();

				const putRes = await fetch(uploadUrl, {
					method: 'PUT',
					headers: { 'Content-Type': file.type },
					body: file,
				});

				if (!putRes.ok) {
					throw new Error('Failed to upload file to storage');
				}

				await updateProject.mutateAsync({ id: projectId, logoUrl: publicUrl });
			} finally {
				setUploading(false);
			}
		},
		[updateProject],
	);

	const handleLogoSelect = (file: File) => {
		if (file.size > 512 * 1024) {
			toast.error('Logo must be under 512KB');
			return;
		}
		if (!file.type.startsWith('image/')) {
			toast.error('Only image files are allowed');
			return;
		}
		setLogoFile(file);
		setLogoPreview(URL.createObjectURL(file));
	};

	const handleLogoRemove = () => {
		if (logoPreview) URL.revokeObjectURL(logoPreview);
		setLogoFile(null);
		setLogoPreview(null);
	};

	const handleContinueToStep2 = async () => {
		const valid = await form.trigger('name');
		if (valid) setStep(2);
	};

	const handleContinueToStep3 = () => {
		setStep(3);
	};

	const handleContinueToStep4 = () => {
		setStep(4);
	};

	const handleCreate = () => {
		const values = form.getValues();
		createProject.mutate({
			name: values.name.trim(),
			mode: values.mode,
			companyName: values.companyName?.trim() || undefined,
			brandColor: values.brandColor || undefined,
		});
	};

	const name = form.watch('name');
	const mode = form.watch('mode');
	const brandColor = form.watch('brandColor');
	const companyName = form.watch('companyName');

	return (
		<div className="mx-auto max-w-lg rounded-2xl border bg-card px-6 py-9 sm:px-10">
			<div className="mb-8 text-center">
				<p className="workspace-kicker">YOUR NEXT CHAPTER</p>
				<h1 className="mb-2 text-2xl font-semibold text-foreground">Create your first project</h1>
				<p className="text-sm text-muted">
					Projects organize your signups. Let&apos;s get started.
				</p>
			</div>

			{/* Step indicator */}
			<div
				className="mb-8 flex justify-center gap-2"
				role="img"
				aria-label={`Step ${step} of ${TOTAL_STEPS}`}
			>
				{Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
					<div
						key={s}
						className={cn(
							'h-1 w-8 rounded-full transition-colors',
							s <= step ? 'bg-foreground' : 'bg-border',
						)}
					/>
				))}
			</div>

			<Form {...form}>
				{/* Step 1: Project Name */}
				{step === 1 && (
					<div>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Project name</FormLabel>
									<FormControl>
										<Input
											type="text"
											placeholder="Your next big idea"
											maxLength={100}
											{...field}
										/>
									</FormControl>
									<FormMessage />
									<p className="text-xs text-muted-foreground">
										Give your project a name you&apos;ll recognize in the dashboard.
									</p>
								</FormItem>
							)}
						/>
						<Button
							type="button"
							onClick={handleContinueToStep2}
							disabled={!name.trim()}
							className="mt-6 w-full"
						>
							Continue
						</Button>
					</div>
				)}

				{/* Step 2: Mode Selection */}
				{step === 2 && (
					<div>
						<p className="mb-3 text-sm font-medium">Choose a mode</p>
						<div className="flex flex-col gap-3">
							{(['waitlist', 'demo-booking'] as const).map((m) => {
								const info = modeDescriptions[m];
								const isSelected = mode === m;
								return (
									<button
										key={m}
										type="button"
										onClick={() => form.setValue('mode', m)}
										className={cn(
											'rounded-lg border p-4 text-left transition-colors',
											isSelected
												? 'border-2 border-foreground bg-accent'
												: 'border-border bg-card hover:bg-accent/50',
										)}
									>
										<div className="mb-1 text-sm font-semibold">{info.label}</div>
										<div className="mb-1.5 text-[0.8125rem] text-muted">{info.description}</div>
										<div className="text-xs text-muted-foreground">{info.fields}</div>
									</button>
								);
							})}
						</div>
						<p className="mt-3 text-xs text-muted-foreground">
							Mode cannot be changed after project creation.
						</p>
						<div className="mt-6 flex gap-3">
							<Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
								Back
							</Button>
							<Button className="flex-1" onClick={handleContinueToStep3}>
								Continue
							</Button>
						</div>
					</div>
				)}

				{/* Step 3: Branding (optional) */}
				{step === 3 && (
					<div>
						<p className="mb-1 text-sm font-medium">Brand your project</p>
						<p className="mb-5 text-xs text-muted-foreground">
							Customize how your emails and public pages look. All fields are optional.
						</p>

						<div className="space-y-5">
							{/* Logo upload */}
							<div>
								<div className="mb-2 text-xs font-medium text-muted-foreground">Logo</div>
								<div className="flex items-center gap-4">
									{logoPreview ? (
										<div className="relative">
											<img
												src={logoPreview}
												alt="Logo preview"
												className="h-16 w-16 rounded-md border border-border/50 object-contain"
											/>
											<button
												type="button"
												onClick={handleLogoRemove}
												className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm"
											>
												<X className="h-3 w-3" />
											</button>
										</div>
									) : (
										<label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border/50 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
											<Upload className="h-5 w-5" />
											<input
												type="file"
												accept="image/*"
												className="hidden"
												onChange={(e) => {
													const file = e.target.files?.[0];
													if (file) handleLogoSelect(file);
												}}
											/>
										</label>
									)}
									<div className="text-xs text-muted-foreground">Max 512KB, image files only</div>
								</div>
							</div>

							{/* Brand color */}
							<FormField
								control={form.control}
								name="brandColor"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-xs text-muted-foreground">Brand Color</FormLabel>
										<FormControl>
											<ColorPicker value={field.value ?? '#0d9488'} onChange={field.onChange} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							{/* Company name */}
							<FormField
								control={form.control}
								name="companyName"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-xs text-muted-foreground">Company Name</FormLabel>
										<FormControl>
											<Input type="text" placeholder="Acme Inc" maxLength={100} {...field} />
										</FormControl>
										<p className="text-[11px] text-muted-foreground">
											Used in email footers and as the sender name.
										</p>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="mt-6 flex gap-3">
							<Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
								Back
							</Button>
							<Button className="flex-1" onClick={handleContinueToStep4}>
								Continue
							</Button>
						</div>
						<button
							type="button"
							onClick={handleContinueToStep4}
							className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
						>
							Skip, I&apos;ll do this later
						</button>
					</div>
				)}

				{/* Step 4: Review and Create */}
				{step === 4 && (
					<div>
						<p className="mb-4 text-sm font-medium">Review your project</p>
						<div className="mb-6 rounded-lg border bg-accent p-4">
							<div className="mb-3">
								<span className="block text-xs text-muted-foreground">Name</span>
								<span className="text-sm font-medium">{name}</span>
							</div>
							<div className="mb-3">
								<span className="block text-xs text-muted-foreground">Mode</span>
								<span className="text-sm font-medium">{modeDescriptions[mode].label}</span>
							</div>
							<div className="mb-3">
								<span className="block text-xs text-muted-foreground">Fields collected</span>
								<span className="text-sm">
									{mode === 'waitlist' ? 'Email only' : 'Email, Name, Company, Message'}
								</span>
							</div>
							{(brandColor || companyName || logoPreview) && (
								<div className="border-t border-border/50 pt-3">
									<span className="mb-2 block text-xs text-muted-foreground">Branding</span>
									<div className="flex items-center gap-3">
										{logoPreview && (
											<img
												src={logoPreview}
												alt="Logo"
												className="h-8 w-8 rounded border border-border/50 object-contain"
											/>
										)}
										{brandColor && (
											<div className="flex items-center gap-1.5">
												<span
													className="h-4 w-4 rounded-full border border-border/50"
													style={{ backgroundColor: brandColor }}
												/>
												<span className="font-mono text-xs text-muted-foreground">
													{brandColor}
												</span>
											</div>
										)}
										{companyName && (
											<span className="text-sm text-muted-foreground">{companyName}</span>
										)}
									</div>
								</div>
							)}
						</div>
						<div className="flex gap-3">
							<Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
								Back
							</Button>
							<Button
								className="flex-1"
								disabled={createProject.isPending || uploading}
								onClick={handleCreate}
							>
								{createProject.isPending || uploading ? 'Creating...' : 'Create Project'}
							</Button>
						</div>
					</div>
				)}
			</Form>
		</div>
	);
}
