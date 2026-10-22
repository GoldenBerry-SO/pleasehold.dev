// ABOUTME: Responsive workspace layout with a persistent desktop sidebar and accessible mobile drawer.
// ABOUTME: Shares project and account dialogs across navigation layouts.
import { Menu, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { CreateProjectDialog } from './CreateProjectDialog';
import { PauseLogo } from './PauseLogo';
import { SettingsDialog } from './SettingsDialog';
import { Sidebar } from './Sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
	const isMobile = useIsMobile();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [settingsTab, setSettingsTab] = useState<'profile' | 'billing'>('profile');
	const sidebar = (
		<Sidebar
			onClose={() => setMobileMenuOpen(false)}
			onCreateProject={() => setCreateOpen(true)}
			onOpenSettings={(tab) => {
				setSettingsTab(tab ?? 'profile');
				setSettingsOpen(true);
			}}
		/>
	);
	return (
		<div className="flex h-dvh">
			{isMobile ? (
				<Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
					<header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 text-[#edf6e9]">
						<Dialog.Trigger asChild>
							<button
								type="button"
								aria-label="Open navigation"
								className="rounded-md p-2 hover:bg-white/10"
							>
								<Menu className="h-5 w-5" />
							</button>
						</Dialog.Trigger>
						<PauseLogo size={25} className="text-[#b6efce] [--pause-bars:#082d29]" />
						<span className="font-heading text-lg font-bold tracking-tight">pleasehold</span>
					</header>
					<Dialog.Portal>
						<Dialog.Overlay className="fixed inset-0 z-50 bg-[#082d29]/40 backdrop-blur-sm" />
						<Dialog.Content
							aria-describedby={undefined}
							className="fixed inset-y-0 left-0 z-50 w-60 outline-none"
						>
							<Dialog.Title className="sr-only">Workspace navigation</Dialog.Title>
							<Dialog.Close asChild>
								<button
									type="button"
									aria-label="Close navigation"
									className="absolute right-2 top-2 z-10 rounded-md p-2 text-[#d5ecd9] hover:bg-white/10"
								>
									<X className="h-4 w-4" />
								</button>
							</Dialog.Close>
							{sidebar}
						</Dialog.Content>
					</Dialog.Portal>
				</Dialog.Root>
			) : (
				<div className="w-60 shrink-0">{sidebar}</div>
			)}
			<main className="app-main min-w-0 flex-1 overflow-y-auto bg-background px-5 pb-10 pt-24 md:px-8 md:py-9">
				{children}
			</main>
			<CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
			<SettingsDialog
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				defaultTab={settingsTab}
			/>
		</div>
	);
}
