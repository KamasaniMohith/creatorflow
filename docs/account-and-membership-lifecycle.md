# Account, invitation, and workspace lifecycle

These workflows are intentionally **not implemented** by the Stage 1 foundation. Authenticated users cannot insert membership rows, change owner roles, delete workspaces, or write integration connection records directly. Implement these workflows only through separately reviewed, narrow database functions or server operations.

## Invitation acceptance

Do not let an owner/admin submit an arbitrary `user_id` to create membership. Proposed workflow:

1. Owner/admin requests an invitation by verified email and an allowed role. A trusted server resolves the caller from the Supabase session and checks that caller's role; an admin may invite only members/viewers.
2. A future `workspace_invitations` table stores workspace, normalized email, requested role, inviter UUID, a hash of a random single-use token, expiry, creation time, and acceptance/revocation timestamps. Do not store the raw token. Constrain statuses and add indexes/uniqueness for active invitation handling.
3. Send the link from a trusted server only after the invitation transaction commits. The acceptance URL must not grant access merely by being opened.
4. The recipient authenticates and verifies control of the invited email. A narrow `SECURITY DEFINER` acceptance RPC derives the user from `auth.uid()`, locks and validates the invitation, compares the verified auth email with the invitation email, checks expiry and unused state, revalidates the inviter's authority/role boundary as appropriate, inserts exactly one membership, and marks the invitation accepted in one transaction. It accepts a token, not a user ID or caller role.
5. Apply rate limits, generic responses that avoid email enumeration, one-time token consumption, audit events, and expiration/revocation handling. Keep invitation table reads/writes unavailable to ordinary browser clients except through role-scoped policies/RPCs.

Until that feature is implemented, no one can add another user to a workspace through the browser-facing SQL grants/policies.

## Ownership transfer

No ownership-transfer function is provided yet. A future atomic owner-only RPC must derive the acting owner from `auth.uid()`, lock the workspace and both membership rows, require the target to be an existing member, promote the target and demote/retain the prior owner atomically, write an audit event, and preserve at least one owner on every committed state. It must reject arbitrary target workspaces and stale/non-owner callers. The last-owner trigger is a second invariant guard, not a substitute for that RPC.

## Last-owner protection

The migration has no authenticated policy that deletes or demotes an owner. AFTER-statement DELETE and UPDATE triggers inspect transition tables and reject a resulting membership state with no owner, including multi-row operations. For every workspace affected by owner removal/demotion, the trigger increments a private `app_private.workspace_owner_guard` row before checking:

- Under `READ COMMITTED`, competing changes serialize on that row. After waiting, the second statement checks the committed result plus its own changes and is rejected if no owner would remain.
- Under `REPEATABLE READ`, a transaction whose snapshot predates a concurrent guard-row update gets a serialization failure when it attempts to update that row. It must abort; the caller must re-read and re-authorize before attempting any retry.
- A multi-row DELETE/UPDATE is checked against the statement's final membership state. Removing/demoting every owner in one statement fails and rolls back that statement. A transfer that promotes a successor and demotes the prior owner in one UPDATE may pass if its final state retains an owner.
- The trigger processes multiple affected workspaces in UUID order. Transactions that acquire guard rows across several separate statements in opposite workspace orders can deadlock; PostgreSQL aborts a participant, which preserves the invariant but requires a safe transaction retry.

The guard row is created automatically with each workspace; it is not exposed or writable by application roles. The migration denies `TRUNCATE` on memberships with both a trigger and revoked application-role privileges. Normal server-side DML that bypasses RLS still fires the triggers. Superusers/table owners can disable triggers or use replication-role mechanisms to suppress them; those administrative actions remain outside the guarantee and must be prohibited operationally. The migration does not grant `service_role` direct membership-table privileges. Future privileged workflows must use normal UPDATE/DELETE statements and cannot disable triggers.

No PostgreSQL concurrency test has been executed. Use a disposable local Supabase/PostgreSQL project and the following test plan before applying this migration anywhere. Create two disposable auth users through the local Auth admin API, then create a workspace and two owner memberships as a database administrator; do not use production identities. Confirm that a matching private guard row exists.

Example fixture and statements (replace the UUID placeholders with disposable IDs; run failing statements in autocommit or roll back their transaction):

```sql
INSERT INTO public.workspaces (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000100', 'Owner test', 'owner-test-100');

INSERT INTO public.workspace_members (workspace_id, user_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000100', '<AUTH_USER_A_UUID>', 'owner'),
  ('00000000-0000-0000-0000-000000000100', '<AUTH_USER_B_UUID>', 'owner');

SELECT workspace_id, version
FROM app_private.workspace_owner_guard
WHERE workspace_id = '00000000-0000-0000-0000-000000000100';

-- Single-row and multi-row checks; reset the fixture between cases.
DELETE FROM public.workspace_members
WHERE workspace_id = '00000000-0000-0000-0000-000000000100'
  AND user_id = '<AUTH_USER_A_UUID>';

DELETE FROM public.workspace_members
WHERE workspace_id = '00000000-0000-0000-0000-000000000100'
  AND user_id = '<AUTH_USER_B_UUID>'; -- expect SQLSTATE 23514

DELETE FROM public.workspace_members
WHERE workspace_id = '00000000-0000-0000-0000-000000000100'
  AND role = 'owner'; -- with both owners present, expect SQLSTATE 23514

UPDATE public.workspace_members
SET role = 'member'
WHERE workspace_id = '00000000-0000-0000-0000-000000000100'
  AND role = 'owner'; -- with both owners present, expect SQLSTATE 23514
```

1. **Single-row protection:** With two owners, delete or demote one and confirm it succeeds. Attempt to delete/demote the remaining owner and confirm SQLSTATE `23514` and no committed membership change.
2. **Multi-row protection:** With exactly two owners, run one statement deleting both; then repeat with one statement demoting both. Each statement should fail with `23514` and roll back all affected rows. With three owners, remove two in one statement and confirm one remains.
3. **READ COMMITTED concurrency:** In session A, begin and delete/demote owner A but do not commit. In session B, begin and delete/demote owner B; its after-statement trigger should wait on the shared guard row. Commit A. B should then fail the final-owner check with `23514`; verify exactly one owner remains.
4. **REPEATABLE READ concurrency:** Repeat with both sessions using `BEGIN ISOLATION LEVEL REPEATABLE READ`. In session B, first run a SELECT against the workspace to establish its snapshot before A commits. Let A perform its removal and commit, then allow B to attempt its owner change. B must abort with a serialization failure (`40001`) when updating the stale guard row, or fail closed with `23514`; verify exactly one owner remains.
5. **Privileged-path checks:** In the disposable database only, temporarily grant `UPDATE, DELETE` on `workspace_members` to the local `service_role`; confirm its RLS bypass does not bypass the triggers for ordinary DML, and confirm TRUNCATE remains denied. Remove the temporary grant afterward. Confirm a role without ownership/superuser privileges cannot disable triggers or set `session_replication_role`. Do not test administrative bypass by disabling triggers in a shared or production database.

The precise SQLSTATE and transition-table behavior should be asserted by executing these tests on the PostgreSQL version used by the target Supabase project. To close a workspace with no successor owner, use the future closure workflow; do not bypass the trigger or manually delete its membership.

## Workspace closure

No closure operation or destructive cascade is provided. A future workflow should add an explicit workspace lifecycle state and a narrow owner-only close RPC that locks the workspace, stops new writes/invitations/integration actions, revokes provider credentials through trusted server code, and records closure metadata. Data retention/export and deletion eligibility must be decided before any purge. Actual tenant data deletion should require a separate explicit approval, backup, and reviewed retention policy; do not use cascading workspace deletes.

## Account deletion

`profiles.id` cascades from `auth.users`; `workspace_members.user_id` is restrictive. This intentionally blocks auth-account deletion while memberships remain. Before deleting the auth identity:

- A member/viewer leaves through their own membership deletion or an owner/admin revokes them.
- An admin is revoked by an owner or leaves only if a separate policy is added; ordinary member/admin self-delete is not permitted by this foundation.
- An owner transfers ownership or completes the separately approved closure workflow.
- All membership rows across all workspaces must be removed before the auth user is deleted.

Afterward, the profile is deleted and workspace-owned records remain. Audit actor fields store immutable UUIDs without auth-user foreign keys, so historical actor attribution survives as an opaque UUID even though the profile/account no longer exists. This retention behavior must be included in privacy disclosures and any applicable erasure/retention policy.

## Membership revocation

Owners can revoke admins, members, and viewers. Admins can revoke members and viewers only. Members/viewers may leave their own workspace. No actor may ordinarily remove an owner; role transfer/demotion is a separate owner-transfer process. Revocation removes access immediately through membership-based RLS; it does not delete the user's profile, other memberships, or workspace records.
