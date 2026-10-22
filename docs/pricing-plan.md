# Pricing Implementation Plan

## Pricing Model

Two tiers. That's it.

| | Free | Pro (€19/3 months) |
|---|---|---|
| Entries/mo | 100 | Unlimited |
| Projects | 1 | Unlimited |
| API access | Full | Full |
| Notifications | All channels | All channels |
| Email templates | Default only | Custom + branding |
| Branding | "Powered by pleasehold" badge | Badge removed |
| Team members | 1 | 5 |
| Support | Community | Priority |

Self-hosted = free forever, unlimited, no restrictions.

## Competitive Context (researched 3/5/2026)

| Competitor | Annual Cost | vs pleasehold |
|---|---|---|
| GetWaitlist | $180/yr | 2.4x more expensive |
| Waitlister | $180/yr | 2.4x more expensive |
| Viral Loops | $420/yr | 5.5x more expensive |
| LaunchList | $79 one-time | Comparable year 1 |

None are open source. None offer self-hosting.

## Implementation Phases

### Phase 1: Database Schema
- [x] New `subscriptions` table (migration 0006)
- [x] Relations + exports in schema barrel
- [x] Data seed for existing users

### Phase 2: Plan Constants
- [x] `packages/trpc/src/lib/plan-limits.ts` — limits + `isBillingEnabled()`

### Phase 3: Subscription Seeding
- [x] `onUserCreated` hook in auth config seeds free subscription

### Phase 4: Stripe Integration
- [x] `stripe` npm package in apps/api + packages/trpc
- [x] Stripe client singleton (`apps/api/src/lib/stripe.ts`)
- [x] tRPC subscription router (get, usage, checkout, portal, isEnabled)
- [x] Webhook handler (`/webhooks/stripe`)
- [x] Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`

### Phase 5: Limit Enforcement
- [x] Entry limit: 100/mo on free tier (429 when exceeded)
- [x] Project limit: 1 project on free tier
- [x] Email template customization gated to Pro
- [x] Branding fields (logo, color, company) gated to Pro

### Phase 6: Email Badge
- [x] Free tier always shows "Powered by pleasehold" in email footer
- [x] Pro with company name shows company name instead

### Phase 7: Dashboard Billing Page
- [x] `/settings/billing` route — plan status, usage, upgrade/manage CTA
- [x] Sidebar "Billing" link
- [x] `ProFeatureGate` component for locked UI sections
- [x] Gate branding settings, template editor, project creation for free users

### Phase 8: Landing Page
- [x] `Pricing.astro` component — two-column Free vs Pro
- [x] `/pricing` page
- [x] Nav link to pricing
- [x] Self-hosted callout

### Phase 9: Testing
- [x] Plan limits unit tests (6 tests in plan-limits.test.ts)
- [x] Entry limit integration tests (entries-limit.test.ts)
- [x] Stripe webhook tests (7 tests in stripe.test.ts)
- [x] Email badge worker tests (4 tests in email-layout.test.ts)
- [ ] E2E upgrade/downgrade flow (requires Stripe test mode + browser)

## Design Decisions

1. **Subscription on user, not project** — a user is Free or Pro, all projects inherit
2. **Soft limits** — return 429 but never delete data or pause projects
3. **Stripe is source of truth** — local `subscriptions` table is a cache synced via webhooks
4. **Self-hosted skips billing** — if no `STRIPE_SECRET_KEY`, everything acts as Pro
5. **Don't count duplicates** — dedup'd entries (onConflictDoNothing) don't increment count
