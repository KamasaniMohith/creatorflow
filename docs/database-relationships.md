# CreatorFlow database relationships

The schema is introduced by `supabase/migrations/20261109130000_create_multitenant_foundation.sql`.
This migration creates database objects only; it does not migrate browser or SQLite data.

## Identity and tenancy

- `auth.users` is the identity source.
- `profiles.id` is a one-to-one profile reference to `auth.users.id`; deleting the auth account removes only this profile row.
- A workspace has a UUID `workspaces.id` and a unique case-insensitive slug.
- `workspace_members` links users to workspaces and has one membership per `(workspace_id, user_id)`.
- `public.create_workspace(name, slug)` creates the workspace, profile if missing, and initial owner membership in one database transaction. A caller cannot supply the owner identity or role.

## Tenant records

Every agency-owned table has a non-null `workspace_id` foreign key to `workspaces`.
Existing creator, campaign, outreach, template, delivery, event, conversation, and message identifiers are text where necessary so current prefixed IDs and provider IDs do not need to be rewritten.

- `creators`: workspace-owned profiles. The bundled demonstration catalogue remains in the application and is not placed into this table by the migration. An agency may explicitly copy a catalogue entry into its workspace later.
- `campaigns`: campaign metadata.
- `campaign_creators`: many-to-many campaign/creator association. Composite foreign keys require both rows to belong to the same workspace.
- `shortlist_entries`: workspace shortlist, unique per workspace and creator.
- `outreach_records`: message draft and status, tied to a same-workspace creator and optional campaign.
- `outreach_events`: append-only notes, message/status history, and other events tied to same-workspace outreach.
- `message_templates`: workspace copies of templates. The five current defaults should be copied into each workspace and keyed with `system_template_key`; they are not globally editable records.
- `integration_connections`: provider configuration per workspace. Instagram conversation rows reference the same workspace’s connection and account.
- `email_delivery_attempts`: delivery snapshots tied to a same-workspace outreach, creator, and optional campaign. Composite constraints also require the delivery’s creator/campaign IDs to match its outreach record.
- `email_webhook_events`: deduplicated provider event IDs tied to the same workspace’s delivery attempt. Full raw webhook bodies are not stored.
- `instagram_conversations`: workspace/account-scoped recipient conversations.
- `instagram_messages`: messages tied to a same-workspace conversation; provider message IDs are unique per workspace.

## Delete behavior

Valuable tenant relationships use `ON DELETE RESTRICT`; removal must be explicit and ordered. The only foreign keys to `auth.users` are `profiles.id ON DELETE CASCADE` and `workspace_members.user_id ON DELETE RESTRICT`. Audit attribution columns (`created_by`, `invited_by`, `added_by`, and `actor_user_id`) intentionally store immutable UUID values without auth-user foreign keys. This preserves historical attribution after profile/account deletion and avoids `ON DELETE SET NULL` updates conflicting with identity immutability.

An account cannot be deleted while it has a membership in any workspace. Members/viewers must leave, or an owner/admin must revoke them. Owners must first transfer ownership or follow the separately approved workspace-closure workflow. Once no memberships remain, auth-user deletion cascades the profile but leaves workspace and audit history. The audit UUID remains an opaque historical identifier; it does not guarantee that the auth account still exists.

Creator/campaign deletion requires explicit handling of association/outreach records, and workspace deletion is blocked while tenant data remains. Disconnecting an integration should clear/revoke credentials while retaining its row and history; deleting a connection with Instagram history is intentionally restricted. See [account and membership lifecycle](./account-and-membership-lifecycle.md).
