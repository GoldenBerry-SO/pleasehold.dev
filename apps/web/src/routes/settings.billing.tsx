// ABOUTME: Billing route used for Stripe Checkout and customer portal returns.
// ABOUTME: Shares billing controls with the settings dialog.

import { createFileRoute } from '@tanstack/react-router';
import { BillingPanel } from '@/components/BillingPanel';

export const Route = createFileRoute('/settings/billing')({ component: BillingPanel });
