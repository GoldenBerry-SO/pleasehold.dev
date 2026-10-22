// ABOUTME: Shared introduction and form layout for login, signup, and email verification.
// ABOUTME: Carries the public site's typography and developer-focused visual identity into auth.
import type { ReactNode } from 'react';
import { PauseLogo } from './PauseLogo';

function Brand({ mobile = false }: { mobile?: boolean }) {
	return (
		<a href="https://pleasehold.dev" className={`auth-brand ${mobile ? 'auth-mobile-brand' : ''}`}>
			<PauseLogo size={32} />
			pleasehold<span className="font-normal opacity-60">.dev</span>
		</a>
	);
}

export function AuthLayout({ children }: { children: ReactNode }) {
	return (
		<div className="auth-layout">
			<aside className="auth-story">
				<Brand />
				<div className="auth-story-content">
					<p className="workspace-kicker">Keep building. We’ll keep the list.</p>
					<h2>
						Your next idea.
						<br />
						<span>Its first users.</span>
					</h2>
					<p>
						A small API for the big thing you’re building. Collect early interest, connect your
						tools, and make your next launch count.
					</p>
					<div className="auth-code" role="img" aria-label="Example API request">
						<div>ONE CALL. YOU’RE CONNECTED.</div>
						<code>
							<span className="text-[#b6efce]">POST</span> /api/v1/entries
						</code>
						<code>{'{ "email": "ada@example.com" }'}</code>
						<div className="auth-response">✓ 201 Created · Example response</div>
					</div>
				</div>
				<div className="auth-story-footer">
					<span>Waitlists. One API call.</span>
					<a href="https://github.com/GoldenBerry-SO/pleasehold.dev">Open source ↗</a>
				</div>
			</aside>
			<main className="auth-form-panel">
				<div>
					<Brand mobile />
					{children}
					<p className="auth-form-note">
						Built for people who build. A GoldenBerry Studio product.
					</p>
				</div>
			</main>
		</div>
	);
}
