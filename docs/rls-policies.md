# CreatorFlow Row Level Security design

## Enforcement model

RLS is enabled and forced on profiles and every workspace-owned table in the foundation migration. Tenant rows carry `workspace_id NOT NULL`; composite foreign keys validate tenant relationships even if an application query is incorrect.

The `app_private` schema contains narrowly scoped `SECURITY DEFINER` helpers and a private owner-guard serialization table:

- `is_workspace_member(workspace_id)` checks membership for `auth.uid()`.
- `has_workspace_role(workspace_id, roles)` checks roles for `auth.uid()`.
- `shares_workspace_with(user_id)` permits access to a profile only when the authenticated caller and target share a workspace.

Each helper uses a fixed `search_path`, fully qualified tables and `auth.uid()`, does not accept a caller identity, and has execution revoked from `PUBLIC` and `anon`. The definer privilege is needed to read memberships without recursively invoking membership-table RLS. `create_workspace(name, slug)` is a separate fixed-search-path definer RPC; it uses only `auth.uid()` and atomically creates the workspace and initial owner membership. `prevent_last_owner_removal()` is a trigger-only definer function invoked after a membership DELETE or UPDATE statement. For each affected workspace it updates a private serialization row, then checks the statement's resulting membership state; it has no caller-executable grant. Direct authenticated workspace or membership insertion is not granted.

The owner-guard row is created automatically for every workspace, is RLS-enabled/forced with no client policies or grants, and is updated only by the trigger function. The post-statement triggers use transition tables to validate the final result of a multi-row DELETE or UPDATE, not a row-by-row intermediate state. A `TRUNCATE` trigger rejects truncation, and application roles have no TRUNCATE grant.

## Policy matrix

| Data | Read | Insert | Update | Delete |
|---|---|---|---|---|
| Profile | Self and users sharing a workspace | Self only | Self only | Not granted |
| Workspace | Members | Only the atomic RPC | Owner/admin | Not granted |
| Membership | Workspace members | Not granted to authenticated clients; initial owner only through atomic workspace creation | Owner can modify non-owner roles; admin can modify member/viewer only; owner role cannot be set by ordinary update | Owner can remove admin/member/viewer; admin can remove member/viewer; member/viewer may leave. Owners cannot leave this way, and statement-level triggers reject any operation whose final state has no owner. |
| Creators, campaigns, outreach, templates | Workspace members | Owner/admin/member; attribution must equal `auth.uid()` | Owner/admin/member | Owner/admin/member |
| Campaign associations, shortlist | Workspace members | Owner/admin/member; `added_by` must equal `auth.uid()` | Not granted; replace association explicitly | Owner/admin/member |
| Outreach events | Workspace members | Owner/admin/member; actor must equal `auth.uid()` | Not granted (append-only) | Not granted |
| Integration connection metadata | Workspace members, limited by column grants | Not granted to browser | Not granted to browser | Not granted to browser |
| Email attempts and Instagram conversations/messages | Workspace members | Not granted to browser clients | Not granted to browser clients | Not granted to browser clients |
| Email webhook event metadata | Owner/admin only | Not granted to browser clients | Not granted to browser clients | Not granted to browser clients |

Viewers can read tenant data and approved, non-secret integration metadata but cannot modify it. No client-supplied user ID or role participates in policy decisions. Workspace IDs are authorization selectors only: membership is resolved from the authenticated database identity, and all relationships are protected by composite workspace foreign keys.

Membership insertion is intentionally unavailable to authenticated clients until a secure invitation workflow exists. No browser operation can assign an arbitrary user ID or the `owner` role. Ownership transfer and workspace closure are not exposed by this foundation; use the separately documented lifecycle proposal.

## Credential and server boundary

Authenticated SQL privileges on `integration_connections` grant only SELECT on approved metadata columns; there are no authenticated INSERT/UPDATE policies or grants. The `encrypted_access_token` column is omitted, so browser queries cannot retrieve or write it, even for an owner. The service role is granted server-side access only because Supabase service-role access bypasses RLS. It must never enter a `NEXT_PUBLIC_` variable or browser bundle. Any server endpoint/action using that key must independently validate the user, workspace membership, role, and request before a privileged operation. Provider webhook handlers are also trusted server-only writers and must validate signatures before recording events.

The only auth-user foreign keys are the profile cascade and restrictive membership reference. Audit actor UUIDs are deliberately not foreign keys: they are preserved after account deletion and protected from ordinary updates by the immutable-identity trigger. Deleting an auth account requires clearing all memberships first; last-owner protection requires transfer or an approved closure process.

All `SECURITY DEFINER` routines have explicit `postgres` ownership and a fixed `pg_catalog` search path. Membership lookup functions use fully qualified table names and `auth.uid()`. They are granted to `authenticated` only for RLS use; the `app_private` schema is not intended to be exposed through PostgREST. `create_workspace` is intentionally callable by authenticated users, but derives the owner solely from `auth.uid()`. Trigger-only functions have execute revoked from application roles. These functions rely on the trusted Supabase `postgres` owner bypassing FORCE RLS to inspect or update private rows; do not transfer their ownership to application roles.

The non-definer trigger helpers `prevent_identity_change()`, `set_updated_at()`, and `prevent_workspace_members_truncate()` also have explicit `postgres` ownership, fixed search paths, and no application-role EXECUTE grants. The truncate helper only raises an exception; the others validate/update trigger rows. They are not directly callable by authenticated clients.

### Definer-function review

| Function | Caller access | Security boundary |
|---|---|---|
| `app_private.is_workspace_member(uuid)` | Execute granted to `authenticated` for policy evaluation | Returns only whether `auth.uid()` belongs to the supplied workspace; no caller user ID argument. |
| `app_private.has_workspace_role(uuid, workspace_role[])` | Execute granted to `authenticated` for policy evaluation | Returns only whether `auth.uid()` has one of the supplied roles in the supplied workspace; no data or mutation. |
| `app_private.shares_workspace_with(uuid)` | Execute granted to `authenticated` for profile policy evaluation | Returns only a shared-workspace boolean for `auth.uid()` and the supplied user. |
| `public.create_workspace(text, text)` | Execute granted to `authenticated` | Uses only `auth.uid()` for identity/owner role, validates input, creates one workspace and owner in one transaction. |
| `app_private.prevent_last_owner_removal()` | Trigger invocation only; explicit EXECUTE revoked from application roles | Serializes affected workspaces through private guard rows and rejects DELETE/UPDATE statements whose final state has no owner. |
| `app_private.create_workspace_owner_guard()` | Trigger invocation only; explicit EXECUTE revoked from application roles | Creates one private serialization row for every workspace. |

Every function has an explicit `postgres` owner and fixed `pg_catalog` search path. The three predicate helpers are intentionally callable by the policy evaluator; if `app_private` were exposed as a PostgREST schema, they could also be used as boolean membership/role probes for guessed UUIDs. Keep `app_private` out of exposed schemas. The trigger function cannot be called directly by authenticated clients. No function accepts an arbitrary actor identity or returns membership rows.

### Last-owner concurrency guarantee and limits

The membership DELETE and UPDATE triggers validate after each statement using transition tables. Before checking, the definer function increments the workspace's private owner-guard version row. Under `READ COMMITTED`, concurrent owner-removal statements serialize on that row; the waiter checks membership state after the first transaction commits and fails if it would leave no owner. Under `REPEATABLE READ`, if a competing transaction's snapshot predates the first transaction's guard-row update, PostgreSQL aborts the waiter with a serialization failure rather than allowing a stale-snapshot check. Callers must surface that failure and re-read/re-authorize before retrying.

This protects ordinary SQL DELETE/UPDATE statements even when invoked by a trusted server role that bypasses RLS, because RLS bypass does not disable triggers. The migration does not grant `service_role` direct table privileges; future trusted workflows must use normal DML and must not disable triggers, use `session_replication_role = replica`, or otherwise operate as a superuser/table owner that can suppress trigger enforcement. Such administrative bypasses cannot be prevented by table triggers. `TRUNCATE` is explicitly rejected by a trigger and revoked from application roles. PostgreSQL execution and concurrency tests have not been run; this is a design-level guarantee pending the disposable-database test plan in the lifecycle document.

This migration does not make the application authenticated: the frontend still uses LocalStorage and existing development-gated APIs. RLS has not been applied to the live project or tested with real Supabase users yet.
