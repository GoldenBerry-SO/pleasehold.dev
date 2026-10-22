// ABOUTME: PostHog-style tabbed integration guide with numbered steps per platform.
// ABOUTME: Each tab shows a walkthrough for Next.js, Astro, React, HTML, or cURL with code + prose.

import { Check, Copy, Sparkles } from 'lucide-react';
import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface ApiKeyDocsProps {
	apiKeyPrefix?: string;
	apiBaseUrl: string;
}

interface Step {
	title: string;
	description: string;
	code?: string;
	filename?: string;
}

const tabs = ['Next.js', 'Astro', 'React', 'HTML', 'cURL'] as const;
type Tab = (typeof tabs)[number];

function buildSteps(tab: Tab, key: string, baseUrl: string): Step[] {
	const endpoint = `${baseUrl}/api/v1/entries`;

	switch (tab) {
		case 'Next.js':
			return [
				{
					title: 'Create a Server Action',
					description:
						'Server Actions keep your API key on the server so it never reaches the browser. Create a new file in your app directory.',
					filename: 'app/waitlist/action.ts',
					code: `"use server";

export async function joinWaitlist(formData: FormData) {
  const res = await fetch("${endpoint}", {
    method: "POST",
    headers: {
      "x-api-key": "${key}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: formData.get("email"),
      name: formData.get("name"),
    }),
  });

  if (!res.ok) throw new Error("Failed to join waitlist");
  return res.json();
}`,
				},
				{
					title: 'Build the waitlist form',
					description:
						'Create a page that uses the Server Action. The form submits directly to your action without any client-side JavaScript.',
					filename: 'app/waitlist/page.tsx',
					code: `import { joinWaitlist } from "./action";

export default function WaitlistPage() {
  return (
    <form action={joinWaitlist}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit">Join Waitlist</button>
    </form>
  );
}`,
				},
				{
					title: 'Store your key in environment variables',
					description:
						'Move the API key out of your code and into your .env.local file. Update the action to read from process.env.',
					filename: '.env.local',
					code: `PLEASEHOLD_API_KEY=${key}`,
				},
			];

		case 'Astro':
			return [
				{
					title: 'Create an API route',
					description:
						'Astro API routes run on the server, keeping your key secure. Make sure SSR is enabled in your astro.config.',
					filename: 'src/pages/api/waitlist.ts',
					code: `import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  const res = await fetch("${endpoint}", {
    method: "POST",
    headers: {
      "x-api-key": "${key}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: body.email,
      name: body.name,
    }),
  });

  return new Response(JSON.stringify(await res.json()), {
    status: res.status,
  });
};`,
				},
				{
					title: 'Add the form to your page',
					description:
						'Create a form that posts to your API route. The inline script handles the submission and shows a success message.',
					filename: 'src/pages/index.astro',
					code: `<form id="waitlist-form">
  <input name="name" placeholder="Name" required />
  <input name="email" type="email" placeholder="Email" required />
  <button type="submit">Join Waitlist</button>
</form>

<script>
  document.getElementById("waitlist-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = new FormData(e.target as HTMLFormElement);
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          name: form.get("name"),
        }),
      });
      if (res.ok) {
        (e.target as HTMLFormElement).innerHTML =
          "<p>You're on the list!</p>";
      }
    });
</script>`,
				},
				{
					title: 'Use environment variables',
					description:
						'Move the key to a .env file and access it via import.meta.env in your API route. Prefix with PUBLIC_ only if you intend to expose it (you probably don\u2019t).',
					filename: '.env',
					code: `PLEASEHOLD_API_KEY=${key}`,
				},
			];

		case 'React':
			return [
				{
					title: 'Create the WaitlistForm component',
					description:
						'A self-contained form component that handles submission, loading state, and success feedback.',
					filename: 'src/components/WaitlistForm.tsx',
					code: `import { useState } from "react";

export function WaitlistForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");

    const form = new FormData(e.currentTarget);
    const res = await fetch("${endpoint}", {
      method: "POST",
      headers: {
        "x-api-key": "${key}",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
      }),
    });

    if (res.ok) setStatus("done");
  }

  if (status === "done") return <p>You're on the list!</p>;

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Joining..." : "Join Waitlist"}
      </button>
    </form>
  );
}`,
				},
				{
					title: 'Render it in your app',
					description: 'Import the component wherever you want the waitlist form to appear.',
					filename: 'src/App.tsx',
					code: `import { WaitlistForm } from "./components/WaitlistForm";

function App() {
  return (
    <main>
      <h1>Join the Waitlist</h1>
      <WaitlistForm />
    </main>
  );
}`,
				},
				{
					title: 'Secure your key (recommended)',
					description:
						'The example above puts the key in client-side code. For production, proxy through your own backend or use a serverless function so the key stays private.',
					code: `// Example: proxy via /api/waitlist on your backend
const res = await fetch("/api/waitlist", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, name }),
});`,
				},
			];

		case 'HTML':
			return [
				{
					title: 'Add the form HTML',
					description: 'Drop this form into any HTML page. No build tools or frameworks needed.',
					filename: 'index.html',
					code: `<form id="waitlist-form">
  <input name="name" placeholder="Name" required />
  <input name="email" type="email" placeholder="Email" required />
  <button type="submit">Join Waitlist</button>
</form>`,
				},
				{
					title: 'Add the submission script',
					description:
						'Place this script tag after the form. It intercepts the submit event, sends the data to the API, and shows a success message.',
					filename: 'index.html',
					code: `<script>
  document.getElementById("waitlist-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = new FormData(e.target);

      const res = await fetch("${endpoint}", {
        method: "POST",
        headers: {
          "x-api-key": "${key}",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.get("email"),
          name: form.get("name"),
        }),
      });

      if (res.ok) {
        e.target.innerHTML = "<p>You're on the list!</p>";
      }
    });
</script>`,
				},
				{
					title: 'Note on API key exposure',
					description:
						'In a plain HTML setup, the API key is visible in the page source. This is fine for public waitlists, but if you need the key private, proxy requests through a backend server.',
				},
			];

		case 'cURL':
			return [
				{
					title: 'Submit a test entry',
					description:
						'Use cURL to verify your API key works. Run this in your terminal to submit a test entry.',
					code: `curl -X POST ${endpoint} \\
  -H "x-api-key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "test@example.com",
    "name": "Test User"
  }'`,
				},
				{
					title: 'Check the response',
					description:
						'A successful submission returns a 201 status with the created entry. You should see it appear in your entries table immediately.',
					code: `# Expected response:
{
  "id": "entry_abc123",
  "email": "test@example.com",
  "name": "Test User",
  "status": "new",
  "createdAt": "2025-01-15T12:00:00Z"
}`,
				},
				{
					title: 'Include optional fields',
					description: 'You can also send company, phone, and arbitrary metadata with each entry.',
					code: `curl -X POST ${endpoint} \\
  -H "x-api-key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "jane@acme.co",
    "name": "Jane Smith",
    "company": "Acme Inc",
    "phone": "+1-555-0100",
    "metadata": {
      "source": "landing-page",
      "plan": "pro"
    }
  }'`,
				},
			];
	}
}

function buildAiPrompt(key: string, baseUrl: string): string {
	const endpoint = `${baseUrl}/api/v1/entries`;

	return `# Pleasehold Waitlist Integration

## API Endpoint

POST ${endpoint}

## Authentication

Include the API key in the \`x-api-key\` header:

x-api-key: ${key}

## Request Body Schema

| Field      | Type   | Required | Constraints                                |
|------------|--------|----------|--------------------------------------------|
| email      | string | Yes      | Valid email, max 254 characters             |
| name       | string | No       | Min 1, max 200 characters                  |
| company    | string | No       | Min 1, max 200 characters                  |
| message    | string | No       | Min 1, max 2000 characters                 |
| metadata   | object | No       | String/number/boolean/null values, max 4096 bytes serialized |

> **Note:** The project owner configures which optional fields are enabled. If a field is disabled, sending it will return a 400 error. When in doubt, only send \`email\`.

## Example Request Body

\`\`\`json
{
  "email": "jane@acme.co",
  "name": "Jane Smith",
  "company": "Acme Inc",
  "message": "Interested in the pro plan",
  "metadata": {
    "source": "landing-page",
    "plan": "pro"
  }
}
\`\`\`

## Response Shapes

### 201 Created — new entry
\`\`\`json
{
  "data": {
    "id": "entry_abc123",
    "email": "jane@acme.co",
    "name": "Jane Smith",
    "company": "Acme Inc",
    "position": 42,
    "createdAt": "2025-01-15T12:00:00.000Z"
  }
}
\`\`\`

### 200 OK — duplicate (email already on the list)
\`\`\`json
{
  "data": {
    "id": "entry_abc123",
    "email": "jane@acme.co",
    "name": "Jane Smith",
    "company": "Acme Inc",
    "position": 42,
    "createdAt": "2025-01-15T12:00:00.000Z"
  }
}
\`\`\`

### 400 Bad Request — validation error
\`\`\`json
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email" }
  ]
}
\`\`\`

### 401 Unauthorized — invalid or missing API key
\`\`\`json
{ "error": "Invalid API key" }
\`\`\`

### 429 Too Many Requests — rate limited
\`\`\`json
{ "error": "Too many requests" }
\`\`\`

## cURL Example

\`\`\`bash
curl -X POST ${endpoint} \\
  -H "x-api-key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "test@example.com",
    "name": "Test User"
  }'
\`\`\`

## Implementation Guidelines

1. **Keep the API key server-side.** Use a backend route, server action, or serverless function to proxy requests. Never expose the key in client-side JavaScript.
2. **Store the key in an environment variable** (e.g. \`PLEASEHOLD_API_KEY\`). Do not hard-code it.
3. **Handle errors gracefully.** Check the status code and show a user-friendly message for 400 (validation), 401 (auth), and 429 (rate limit) responses.
4. **Add a loading state** to the submit button to prevent double submissions.
5. **Handle duplicates as success.** A 200 response means the email is already on the list — show a positive message, not an error.
6. **Send only enabled fields.** If you are unsure which fields the project accepts, start with just \`email\` and add others once confirmed.
`;
}

function CodeBlock({
	code,
	onCopy,
	copied,
	hasFilename,
}: {
	code: string;
	onCopy: () => void;
	copied: boolean;
	hasFilename?: boolean;
}) {
	return (
		<div className={cn('relative', !hasFilename && 'mt-2')}>
			<pre
				className={cn(
					'overflow-x-auto bg-[#082d29] p-4 text-sm leading-relaxed text-gray-100',
					hasFilename ? 'rounded-b-lg rounded-tr-lg' : 'rounded-lg',
				)}
			>
				<code className="font-mono">{code}</code>
			</pre>
			<button
				type="button"
				onClick={onCopy}
				className={cn(
					'absolute right-3 top-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
					copied
						? 'bg-green-600/20 text-green-400'
						: 'bg-white/10 text-gray-200 hover:bg-white/20 hover:text-gray-200',
				)}
			>
				{copied ? (
					<>
						<Check className="h-3 w-3" />
						Copied
					</>
				) : (
					<>
						<Copy className="h-3 w-3" />
						Copy
					</>
				)}
			</button>
		</div>
	);
}

export function ApiKeyDocs({ apiKeyPrefix, apiBaseUrl }: ApiKeyDocsProps) {
	const [activeTab, setActiveTab] = useState<Tab>('Next.js');
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
	const [copiedAi, setCopiedAi] = useState(false);

	const displayKey = apiKeyPrefix ?? 'YOUR_API_KEY';
	const steps = buildSteps(activeTab, displayKey, apiBaseUrl);

	const handleCopy = useCallback((code: string, index: number) => {
		navigator.clipboard.writeText(code);
		setCopiedIndex(index);
		setTimeout(() => setCopiedIndex(null), 2000);
	}, []);

	const handleCopyAi = useCallback(() => {
		navigator.clipboard.writeText(buildAiPrompt(displayKey, apiBaseUrl));
		setCopiedAi(true);
		setTimeout(() => setCopiedAi(false), 2000);
	}, [displayKey, apiBaseUrl]);

	return (
		<div>
			{/* AI copy button */}
			<div className="mb-3 flex justify-end">
				<button
					type="button"
					onClick={handleCopyAi}
					className={cn(
						'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
						copiedAi
							? 'border-green-600/30 bg-green-600/10 text-green-600'
							: 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
					)}
				>
					{copiedAi ? (
						<>
							<Check className="h-3.5 w-3.5" />
							Copied
						</>
					) : (
						<>
							<Sparkles className="h-3.5 w-3.5" />
							Copy instructions for AI
						</>
					)}
				</button>
			</div>

			{/* Tab row */}
			<div className="flex items-center gap-0 overflow-x-auto border-b border-border">
				{tabs.map((tab) => (
					<button
						key={tab}
						type="button"
						onClick={() => {
							setActiveTab(tab);
							setCopiedIndex(null);
						}}
						className={cn(
							'px-3 py-2 text-xs font-medium transition-colors',
							activeTab === tab
								? 'border-b-2 border-primary text-foreground'
								: 'text-muted hover:text-foreground',
						)}
					>
						{tab}
					</button>
				))}
			</div>

			{/* Steps */}
			<div className="mt-6 space-y-8">
				{steps.map((step, i) => (
					<div key={`${activeTab}-${step.title}`}>
						{/* Step header */}
						<div className="flex items-baseline gap-3">
							<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
								{i + 1}
							</span>
							<h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
						</div>

						{/* Description */}
						<p className="mt-1.5 pl-9 text-sm leading-relaxed text-muted-foreground">
							{step.description}
						</p>

						{/* Filename badge + code block */}
						{step.code && (
							<div className="mt-3 pl-9">
								{step.filename && (
									<div className="inline-block rounded-t-md bg-[#082d29] px-3 py-1 text-xs font-medium text-gray-400">
										{step.filename}
									</div>
								)}
								<CodeBlock
									code={step.code}
									copied={copiedIndex === i}
									onCopy={() => handleCopy(step.code as string, i)}
									hasFilename={!!step.filename}
								/>
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
