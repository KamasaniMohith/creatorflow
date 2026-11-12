# CreatorFlow

CreatorFlow is a multi-tenant creator discovery and outreach application built with Next.js, TypeScript, Supabase Auth, and Supabase PostgreSQL. Workspace-owned creators, campaigns, shortlists, outreach records, timelines, templates, and provider records are stored in workspace-scoped tables protected by Row Level Security. The bundled fictional demo creator catalogue remains read-only and separate from agency data.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` only if `.env.local` does not already exist. Never overwrite an existing environment file.
3. Configure the Supabase project URL and publishable/anon key locally:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Configure `SUPABASE_SERVICE_ROLE_KEY` locally for server-side provider writes. This key is server-only and must never use a `NEXT_PUBLIC_` prefix.
5. Start with `npm run dev`, then open `http://localhost:3000`.

The Supabase migration for the current schema is already deployed to the configured project. Do not create another project or run `supabase db push` as part of application setup. The application uses the existing schema and does not apply migrations at startup.

## Authentication and workspaces

- Users can sign up, sign in, and sign out with Supabase Auth.
- A new user without a workspace is sent to onboarding. Workspace creation uses the existing `create_workspace` database RPC.
- Workspace membership and the active workspace are loaded from authenticated Supabase queries. The active-workspace LocalStorage value is only a display preference; it is not authorization.
- Database RLS remains authoritative for all workspace data. API routes independently validate the signed-in user and membership before trusted server-side provider operations.
- Owners and admins manage integrations; members can work with shared creator and outreach records; viewers have read-only access.

## Existing local data

The app does not automatically delete, rewrite, or migrate existing LocalStorage data. If it finds local application records, the workspace UI offers a migration flow:

1. Download the complete raw LocalStorage backup.
2. Review the normalized record counts and explicitly confirm import.
3. The importer preserves IDs and relationships, copies demo creators only when workspace records reference them, and does not overwrite existing database records.
4. LocalStorage remains unchanged. Duplicate IDs, duplicate creator usernames, and unresolved relationships are skipped and reported.

Keep the downloaded backup until the imported workspace data has been reviewed. The legacy SQLite/libSQL provider database is also left intact; its delivery history and Instagram records are not automatically imported by the browser data migration.

## Provider configuration

Email remains test-only. Configure `OUTREACH_TEST_RECIPIENT` in `.env.local`; CreatorFlow sends only to this address and never uses an email address from a creator record. Resend remains available with `RESEND_API_KEY`, `EMAIL_FROM`, and `RESEND_WEBHOOK_SECRET`. The optional n8n Gmail provider uses server-only `N8N_EMAIL_WEBHOOK_URL` (the confirmed CreatorFlow production webhook) and `N8N_EMAIL_WEBHOOK_SECRET`; choose the provider explicitly in the email composer. Provider failures with an uncertain outcome are not automatically retried or sent through the other provider because n8n has no idempotency mechanism. Check the n8n execution and Gmail before taking further action. The application allows one message per request and checks a five-attempt-per-workspace, rolling 24-hour limit. Resend webhook signatures are verified before workspace delivery records are updated.

Instagram messaging is reply-only. Configure the Meta app ID/secret, callback URI, webhook verification token, `META_GRAPH_API_VERSION`, and a 64-character hexadecimal `INTEGRATION_ENCRYPTION_KEY`. OAuth is bound to the authenticated workspace and user using a short-lived HttpOnly state cookie. Tokens are AES-256-GCM encrypted in server-side workspace connection records and are never selected into browser responses. Replies require a user-initiated conversation within the standard 24-hour window; cold outbound DMs are unsupported.

Provider operations need `SUPABASE_SERVICE_ROLE_KEY` because the deployed schema intentionally denies authenticated direct writes to provider tables. Service-role access is used only in server-only code after the route verifies the user's session, workspace membership, and role. Do not expose this key in browser code or logs.

Generate random values locally with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use independent values for the Instagram encryption key and webhook verification token. Never commit `.env.local`, database credentials, tokens, or service-role credentials.

## Validation

Run:

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

The migration has not been executed against a local PostgreSQL instance as part of application integration work. Build and static checks do not prove RLS or concurrent database behavior; those require disposable PostgreSQL/Supabase testing before public deployment.

## Known limitations

- The five-per-day email test cap is checked against persisted workspace attempts. Because the deployed schema has no atomic rate-limit RPC or counter, simultaneous requests across separate server instances could exceed the cap; do not treat it as a hard distributed quota.
- Legacy SQLite/libSQL provider records remain in their original database and are not yet backfilled into the workspace tables. They are not deleted or overwritten. A separately reviewed, explicitly confirmed provider-record import is needed if those records must appear in Supabase.
- Authentication and workspace enforcement are implemented, but deployment readiness still depends on configuring secrets locally, validating the existing deployed schema, and running authentication, RLS-isolation, provider-safety, and concurrency tests. A successful build alone is not a security sign-off.
