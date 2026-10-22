// Motion is progressive enhancement: content stays visible without JavaScript.
const root = document.documentElement;
const control = document.querySelector<HTMLButtonElement>('.motion-control');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
let paused = false;
let enabled = false;
const entrances = new Set<Animation>();
const tilted = new Set<HTMLElement>();

function resetTilts() {
	for (const el of tilted) {
		el.style.removeProperty('--tilt-x');
		el.style.removeProperty('--tilt-y');
		el.style.removeProperty('--pointer-x');
		el.style.removeProperty('--pointer-y');
	}
	tilted.clear();
}
function syncMotion() {
	enabled = !paused && !reduced.matches && !document.hidden;
	root.dataset.motion = enabled ? 'on' : 'off';
	if (!enabled) {
		for (const animation of entrances) animation.cancel();
		entrances.clear();
		resetTilts();
	}
	if (control) {
		control.hidden = false;
		control.disabled = reduced.matches;
		control.setAttribute('aria-pressed', String(paused || reduced.matches));
		control.setAttribute(
			'aria-label',
			reduced.matches
				? 'Animations off: reduced motion preference'
				: paused
					? 'Play animations'
					: 'Pause animations',
		);
		const label = control.querySelector('span');
		if (label)
			label.textContent = reduced.matches
				? 'Reduced motion'
				: paused
					? 'Play motion'
					: 'Pause motion';
	}
}
control?.addEventListener('click', () => {
	paused = !paused;
	syncMotion();
});
reduced.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', syncMotion);
finePointer.addEventListener('change', resetTilts);
syncMotion();

// Only animate the scenes currently on screen, and stop work in background tabs.
if ('IntersectionObserver' in window) {
	const sceneObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries)
				(entry.target as HTMLElement).dataset.visible = String(entry.isIntersecting);
		},
		{ rootMargin: '60px' },
	);
	for (const scene of document.querySelectorAll('[data-motion-scene]'))
		sceneObserver.observe(scene);

	const revealObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				revealObserver.unobserve(entry.target);
				if (!enabled) continue;
				const el = entry.target as HTMLElement;
				const animation = el.animate(
					[
						{
							opacity: 0,
							transform: el.classList.contains('product-section')
								? 'perspective(1400px) translateY(50px) rotateX(7deg) scale(.97)'
								: 'translateY(28px)',
						},
						{ opacity: 1, transform: 'perspective(1400px) translateY(0) rotateX(0) scale(1)' },
					],
					{
						duration: 850,
						delay: Number(el.dataset.motionDelay ?? 0),
						easing: 'cubic-bezier(.16,1,.3,1)',
						fill: 'backwards',
					},
				);
				entrances.add(animation);
				animation.finished.then(
					() => entrances.delete(animation),
					() => entrances.delete(animation),
				);
			}
		},
		{ threshold: 0.08 },
	);
	for (const el of document.querySelectorAll<HTMLElement>(
		'.hero-copy > *, .hero-demo, .intro-section > *, .product-section, .section-heading, .steps-grid article, .notification-feature, .feature-grid article, .pricing-card, .self-host, .faq-section > *, .final-inner > :not([aria-hidden])',
	))
		revealObserver.observe(el);
	for (const parent of document.querySelectorAll(
		'.hero-copy, .steps-grid, .feature-grid, .pricing-grid',
	)) {
		Array.from(parent.children).forEach((child, i) => {
			(child as HTMLElement).dataset.motionDelay = String(i * 75);
		});
	}
}

// Small pointer-driven rotations, limited to fine pointers. Touch scrolling stays native.
for (const surface of document.querySelectorAll<HTMLElement>('[data-tilt]')) {
	let frame = 0;
	let pointerX = 0;
	let pointerY = 0;
	const reset = () => {
		cancelAnimationFrame(frame);
		frame = 0;
		surface.style.removeProperty('--tilt-x');
		surface.style.removeProperty('--tilt-y');
		surface.style.removeProperty('--pointer-x');
		surface.style.removeProperty('--pointer-y');
		tilted.delete(surface);
	};
	surface.addEventListener(
		'pointermove',
		(event) => {
			if (!enabled || !finePointer.matches || event.pointerType === 'touch') return;
			pointerX = event.clientX;
			pointerY = event.clientY;
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				if (!enabled || !finePointer.matches) return;
				const bounds = surface.getBoundingClientRect();
				const x = Math.max(0, Math.min(1, (pointerX - bounds.left) / bounds.width));
				const y = Math.max(0, Math.min(1, (pointerY - bounds.top) / bounds.height));
				surface.style.setProperty('--tilt-x', `${(0.5 - y) * 4}deg`);
				surface.style.setProperty('--tilt-y', `${(x - 0.5) * 5}deg`);
				surface.style.setProperty('--pointer-x', `${x * 100}%`);
				surface.style.setProperty('--pointer-y', `${y * 100}%`);
				tilted.add(surface);
			});
		},
		{ passive: true },
	);
	surface.addEventListener('pointerleave', reset);
	surface.addEventListener('pointercancel', reset);
}
