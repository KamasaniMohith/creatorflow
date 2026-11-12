# CreatorFlow database migration recovery

## Stage 1 behavior

The foundation migration only adds schema objects, grants, triggers, and RLS policies. It does not connect to Supabase, import records, change the existing SQLite database, or alter the frontend. No down migration is provided: automatically dropping tenant tables is unsafe once any workspace data exists.

## Before applying in a later stage

1. Confirm the target Supabase project and database region in the Supabase dashboard; do not place secrets in source control or chat.
2. Take and verify a recoverable database backup/snapshot using the project’s supported backup/export method.
3. Keep a separate protected copy of the SQLite file and a raw versioned LocalStorage export from every source browser profile.
4. Review the migration SQL and run it against a disposable Supabase project first.
5. Capture schema/RLS test results and table counts before importing records.

## If a migration or import fails

- Stop writes/import retries until the failed step is understood.
- Preserve the source LocalStorage export and SQLite backup unchanged.
- For a schema-only failure, prefer a forward corrective migration after review. Do not manually drop tables or disable RLS to bypass the error.
- For an import failure, use per-record idempotency keys and the import report to resume; do not delete/re-import the whole workspace.
- Restore a database backup only under an explicit owner-approved recovery decision, after comparing the backup time with all subsequent writes.

## Rollback boundary

Before any user data exists, a reviewed manual teardown of only the named new objects may be possible on a disposable project. On a project with data, recovery is backup/restore or a forward migration; dropping tenant tables would destroy records and is not an automatic rollback strategy.
