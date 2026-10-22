// ABOUTME: Project settings page with editable name, field configuration, and branding controls.
// ABOUTME: Mode is displayed as read-only badge; field toggles auto-save via tRPC mutation.

import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FieldConfigForm } from '@/components/FieldConfigForm';
import { ProFeatureGate } from '@/components/ProFeatureGate';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { useProject } from '@/hooks/useProjects';
import { type ProjectNameValues, projectNameSchema } from '@/lib/schemas';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/projects/$projectId/settings')({
	component: ProjectSettingsPage,
});

const modeBadgeClasses: Record<string, string> = {
	waitlist: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
	'demo-booking': 'bg-violet-100 text-violet-700 hover:bg-violet-100',
};

function ProjectSettingsPage() {
	const { projectId } = Route.useParams();
	const { data: project, isPending, error } = useProject(projectId);

	const form = useForm<ProjectNameValues>({
		resolver: zodResolver(projectNameSchema),
		defaultValues: { name: '' },
	});

	const [brandColor, setBrandColor] = useState('#5e6ad2');
	const [companyName, setCompanyName] = useState('');
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);

	const utils = trpc.useUtils();
	const updateProject = trpc.project.update.useMutation({
		onSuccess: () => {
			toast.success('Settings updated');
			utils.project.getById.invalidate({ id: projectId });
			utils.project.list.invalidate();
		},
		onError: () => {
			toast.error('Failed to update settings');
		},
	});

	useEffect(() => {
		if (project) {
			form.reset({ name: project.name });
			setBrandColor(project.brandColor ?? '#5e6ad2');
			setCompanyName(project.companyName ?? '');
			setLogoUrl(project.logoUrl ?? null);
		}
	}, [project, form]);

	const handleLogoUpload = useCallback(
		async (file: File) => {
			if (file.size > 512 * 1024) {
				toast.error('Logo must be under 512KB');
				return;
			}
			if (!file.type.startsWith('image/')) {
				toast.error('Only image files are allowed');
				return;
			}

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

				setLogoUrl(publicUrl);
				updateProject.mutate({ id: projectId, logoUrl: publicUrl });
			} catch (err) {
				toast.error(err instanceof Error ? err.message : 'Upload failed');
			} finally {
				setUploading(false);
			}
		},
		[projectId, updateProject],
	);

	const handleBrandingSave = () => {
		if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
			toast.error('Brand color must be a valid hex color (e.g. #0d9488)');
			return;
		}
		updateProject.mutate({
			id: projectId,
			brandColor,
			companyName: companyName || null,
		});
	};

	if (isPending) {
		return (
			<div className="py-16 text-center">
				<p className="text-muted">Loading settings...</p>
			</div>
		);
	}

	if (error || !project) {
		return (
			<div className="settings-sections mx-auto max-w-4xl">
				<div className="mb-4">
					<Link
						to="/"
						className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						Back to dashboard
					</Link>
				</div>
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
					Failed to load project settings. Please try again.
				</div>
			</div>
		);
	}

	const onSubmit = (values: ProjectNameValues) => {
		if (values.name.trim() === project.name) return;
		updateProject.mutate({ id: projectId, name: values.name.trim() });
	};

	return (
		<div className="settings-sections mx-auto max-w-4xl">
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

			<h1 className="mb-1 text-xl font-semibold text-foreground">Project Settings</h1>
			<p className="mb-6 text-sm text-muted-foreground">
				Configure project name, collected fields, and branding.
			</p>

			{/* General section */}
			<div className="mb-8">
				<h2 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">General</h2>
				<div className="border-t border-border/50">
					<div className="border-b border-border/50 py-3">
						<Form {...form}>
							<form onSubmit={form.handleSubmit(onSubmit)}>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-xs text-muted-foreground">Project name</FormLabel>
											<div className="flex gap-2">
												<FormControl>
													<Input type="text" maxLength={100} className="h-8 flex-1" {...field} />
												</FormControl>
												<Button
													type="submit"
													size="sm"
													className="h-8 text-xs"
													disabled={
														updateProject.isPending ||
														!form.watch('name').trim() ||
														form.watch('name').trim() === project.name
													}
												>
													{updateProject.isPending ? 'Saving...' : 'Save'}
												</Button>
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>
							</form>
						</Form>
					</div>

					{/* Mode display */}
					<div className="flex items-center border-b border-border/50 py-3">
						<div className="flex-1">
							<Label className="mb-0.5 block text-xs text-muted-foreground">Mode</Label>
							<div className="flex items-center gap-2">
								<Badge
									variant="secondary"
									className={cn(
										'border-0 text-[10px] font-medium px-1.5 py-0',
										modeBadgeClasses[project.mode],
									)}
								>
									{project.mode === 'demo-booking' ? 'Demo Booking' : 'Waitlist'}
								</Badge>
								<span className="text-xs text-muted-foreground">
									Cannot be changed after creation
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Field Configuration section */}
			<div className="mb-8">
				{project.fieldConfig && (
					<FieldConfigForm
						projectId={projectId}
						collectName={project.fieldConfig.collectName}
						collectCompany={project.fieldConfig.collectCompany}
						collectMessage={project.fieldConfig.collectMessage}
					/>
				)}
			</div>

			{/* Branding section */}
			<ProFeatureGate feature="Custom branding">
				<div className="mb-8">
					<h2 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
						Branding
					</h2>
					<p className="mb-3 text-xs text-muted-foreground">
						Customize how your emails and public-facing pages look.
					</p>
					<div className="border-t border-border/50">
						{/* Logo upload */}
						<div className="border-b border-border/50 py-3">
							<Label className="mb-2 block text-xs text-muted-foreground">Logo</Label>
							<div className="flex items-center gap-4">
								{logoUrl ? (
									<div className="relative">
										<img
											src={logoUrl}
											alt="Project logo"
											className="h-16 w-16 rounded-md border border-border/50 object-contain"
										/>
										<button
											type="button"
											onClick={() => {
												setLogoUrl(null);
												updateProject.mutate({ id: projectId, logoUrl: null });
											}}
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
												if (file) handleLogoUpload(file);
											}}
										/>
									</label>
								)}
								<div className="text-xs text-muted-foreground">
									{uploading ? 'Uploading...' : 'Max 512KB, image files only'}
								</div>
							</div>
						</div>

						{/* Brand color */}
						<div className="border-b border-border/50 py-3">
							<Label className="mb-2 block text-xs text-muted-foreground">Brand Color</Label>
							<ColorPicker value={brandColor} onChange={setBrandColor} />
						</div>

						{/* Company name */}
						<div className="border-b border-border/50 py-3">
							<Label className="mb-2 block text-xs text-muted-foreground">Company Name</Label>
							<Input
								type="text"
								value={companyName}
								onChange={(e) => setCompanyName(e.target.value)}
								placeholder="Acme Inc"
								className="h-8 max-w-sm"
								maxLength={100}
							/>
							<p className="mt-1 text-[11px] text-muted-foreground">
								Used in email footers and as the sender name.
							</p>
						</div>
					</div>

					<div className="mt-3">
						<Button
							size="sm"
							className="h-8 text-xs"
							disabled={updateProject.isPending}
							onClick={handleBrandingSave}
						>
							{updateProject.isPending ? 'Saving...' : 'Save Branding'}
						</Button>
					</div>
				</div>
			</ProFeatureGate>
		</div>
	);
}
