# CreatorFlow MVP-to-PostgreSQL mapping

This is a mapping plan, not an import script. The schema migration creates no tenant records and does not access browser LocalStorage or SQLite.

| Existing data | Existing identifier/shape | PostgreSQL destination | Mapping notes |
|---|---|---|---|
| Auth user | Supabase-generated UUID | `profiles`, `workspace_members` | Workspace and owner membership are created through `create_workspace`. |
| Workspace | Does not currently exist | `workspaces` | Generate a UUID and unique slug at onboarding. |
| Bundled creators | `src/data/creators.json`, 330 profiles with string IDs | Remains bundled catalogue | Do not seed/import the global catalogue as an agency’s private creator rows. If a user explicitly copies one, create a workspace `creators` row with the original ID where available, `data_source = 'Demo Dataset'`, and `source = 'catalog_copy'`. |
| User-edited/added creators | LocalStorage overlay keyed by string `id`; user-entry IDs are prefixed strings | `creators` | Preserve ID and all profile fields. Map `subNiche`, `engagementRate`, `averageViews`, `averageLikes`, `averageComments`, `profileUrl`, `dataSource`, and `lastUpdated` to snake_case columns. Use `source = 'manual'` for user entry and `import` for imported rows. |
| Deleted bundled creator IDs | `deletedIds` array in creator LocalStorage value | No direct row | These are browser catalogue visibility markers, not agency-owned creator rows. Retain the raw backup and define how they affect catalogue visibility before any import. |
| Campaign | LocalStorage object; prefixed string ID; embeds `creatorIds` | `campaigns` and `campaign_creators` | Keep campaign ID, metadata, status, and timestamp. Move embedded IDs to join rows only after verifying each creator belongs to the target workspace. |
| Global shortlist | LocalStorage string array of creator IDs | `shortlist_entries` | One row per workspace/creator; malformed or missing creator references must be reported, not silently discarded. |
| Outreach | LocalStorage object; prefixed string ID; references creator and optional campaign | `outreach_records` | Keep ID, text, channel, status, timestamps and campaign/brand snapshots. Preserve existing normalized status vocabulary; record any legacy remapping in the import report. |
| Outreach notes/history | Nested note strings and event objects | `outreach_records.notes` and `outreach_events` | Preserve event IDs, type, text, prior-message snapshots, and event timestamps. Actor is null when no reliable user attribution exists. |
| Default templates | Five stable `template_*` IDs in `src/data/message-templates.ts` | Workspace rows in `message_templates` | Copy defaults into each workspace; preserve stable IDs if they do not conflict and set a per-workspace `system_template_key`. A workspace copy remains editable. |
| Custom templates | LocalStorage template array with prefixed IDs and `custom` flag | `message_templates` | Preserve `custom`, body, subject, channel, and ID. |
| Email attempts | SQLite `email_deliveries`; text ID (currently UUID), outreach/creator/campaign IDs, attempt, status, idempotency key, recipient and content snapshots | `email_delivery_attempts` | Back up SQLite before planned import. Preserve IDs and idempotency keys; reconcile all referenced IDs and assign an authorized workspace before import. |
| Resend event receipts | SQLite event ID and `received_at` only | `email_webhook_events` | The current row does not contain event type or provider timestamp. Populate those fields as unknown/null unless reliable provider history supplies them. Reconcile event to a migrated attempt by provider message ID. |
| Instagram connection | SQLite singleton row (`id = 1`) | `integration_connections` | New workspace-specific UUID; preserve provider account ID, username, token times, and permissions only after a protected backup and workspace assignment. Never export decrypted credentials. |
| Instagram conversations | SQLite opaque 64-character hash IDs, account and recipient IDs | `instagram_conversations` | Preserve conversation ID and timestamps, and link to that workspace’s connection. |
| Instagram messages | SQLite IDs, provider IDs, direction, text, status, timestamp | `instagram_messages` | Preserve identifiers and provider idempotency. Foreign-key checks require the parent conversation to be assigned to the same workspace. |

## Compatibility risks

- LocalStorage is browser-profile-specific and cannot be inventoried server-side. Export the raw versioned values before parsing/normalization; the existing loader can discard malformed/orphan records and maps legacy outreach statuses.
- Campaign associations and shortlist entries may reference deleted or missing creators. Import must report and explicitly resolve those cases before writing.
- Creator/campaign/outreach IDs are not UUIDs. The schema intentionally uses text IDs for these records; do not cast or regenerate them during import.
- Existing timestamps mix date-only and ISO values. Normalize to database timestamps only after retaining the exact source values in a protected export/report.
- The SQLite delivery record contains a provider message ID, but the webhook receipt does not contain event type/timestamp. The existing provider row must be mapped to a workspace through its related delivery/outreach before importing.
- The Instagram connection is a singleton in SQLite. An owner must explicitly assign it to one workspace; do not duplicate one provider token into every workspace.
- The current form IDs and types are not a database type contract. Import should validate every record and return a per-record result; do not treat successful schema creation as successful data migration.
