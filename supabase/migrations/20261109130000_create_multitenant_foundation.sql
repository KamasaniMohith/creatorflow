-- CreatorFlow multi-tenant database foundation.
-- This migration only creates schema objects. It does not import or delete data.
-- Audit actor UUIDs intentionally are not auth.users foreign keys: they remain
-- immutable historical identifiers after an account is deleted.

CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE SCHEMA app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text CHECK (
    display_name IS NULL OR char_length(btrim(display_name)) BETWEEN 1 AND 120
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  slug text NOT NULL CHECK (
    char_length(slug) BETWEEN 3 AND 63
    AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX workspaces_slug_lower_unique ON public.workspaces (lower(slug));

-- A private serialization row is updated whenever an operation removes or
-- demotes owners. Updating a shared row makes concurrent REPEATABLE READ
-- transactions conflict instead of trusting their stale membership snapshots.
CREATE TABLE app_private.workspace_owner_guard (
  workspace_id uuid PRIMARY KEY
    REFERENCES public.workspaces (id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0)
);
ALTER TABLE app_private.workspace_owner_guard OWNER TO postgres;
ALTER TABLE app_private.workspace_owner_guard ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.workspace_owner_guard FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.workspace_owner_guard
  FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON TABLE app_private.workspace_owner_guard IS
  'Private serialization token used by statement-level last-owner guards.';

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  role public.workspace_role NOT NULL,
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_members_workspace_id_id_unique UNIQUE (workspace_id, id),
  CONSTRAINT workspace_members_workspace_user_unique UNIQUE (workspace_id, user_id)
);

-- Creator catalogue records remain bundled in the application. This table only
-- holds records owned by a workspace, including a deliberate catalogue copy.
-- Existing prefixed CreatorFlow IDs are retained as text rather than recast as UUIDs.
CREATE TABLE public.creators (
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  username text NOT NULL CHECK (username ~ '^[A-Za-z0-9_.]{1,30}$'),
  platform text NOT NULL DEFAULT 'Instagram',
  niche text NOT NULL,
  sub_niche text NOT NULL DEFAULT '',
  location text NOT NULL,
  state text NOT NULL DEFAULT '',
  followers bigint NOT NULL CHECK (followers >= 0),
  engagement_rate numeric(5, 2) NOT NULL CHECK (engagement_rate BETWEEN 0 AND 100),
  average_views bigint NOT NULL CHECK (average_views >= 0),
  average_likes bigint NOT NULL DEFAULT 0 CHECK (average_likes >= 0),
  average_comments bigint NOT NULL DEFAULT 0 CHECK (average_comments >= 0),
  email text,
  bio text NOT NULL DEFAULT '',
  profile_url text NOT NULL DEFAULT '',
  avatar text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT '',
  audience_type text NOT NULL DEFAULT '',
  data_source text NOT NULL CHECK (data_source IN ('Demo Dataset', 'User Entry')),
  source text NOT NULL CHECK (source IN ('manual', 'import', 'catalog_copy')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  last_verified_at timestamptz,
  last_updated date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id)
);

CREATE UNIQUE INDEX creators_workspace_platform_username_unique
  ON public.creators (workspace_id, platform, lower(username));
CREATE INDEX creators_workspace_niche ON public.creators (workspace_id, niche);
CREATE INDEX creators_workspace_location ON public.creators (workspace_id, location);
CREATE INDEX creators_workspace_followers ON public.creators (workspace_id, followers);
CREATE INDEX creators_workspace_created_at ON public.creators (workspace_id, created_at DESC);

CREATE TABLE public.campaigns (
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 70),
  brand text NOT NULL CHECK (char_length(btrim(brand)) BETWEEN 2 AND 60),
  niche text NOT NULL,
  location text NOT NULL,
  min_followers bigint NOT NULL CHECK (min_followers >= 0),
  max_followers bigint NOT NULL CHECK (max_followers >= min_followers),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Completed')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id)
);

CREATE INDEX campaigns_workspace_status_created_at
  ON public.campaigns (workspace_id, status, created_at DESC);

CREATE TABLE public.campaign_creators (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  campaign_id text NOT NULL,
  creator_id text NOT NULL,
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, campaign_id, creator_id),
  CONSTRAINT campaign_creators_campaign_workspace_fk
    FOREIGN KEY (workspace_id, campaign_id)
    REFERENCES public.campaigns (workspace_id, id) ON DELETE RESTRICT,
  CONSTRAINT campaign_creators_creator_workspace_fk
    FOREIGN KEY (workspace_id, creator_id)
    REFERENCES public.creators (workspace_id, id) ON DELETE RESTRICT
);

CREATE INDEX campaign_creators_workspace_creator
  ON public.campaign_creators (workspace_id, creator_id);

CREATE TABLE public.shortlist_entries (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  creator_id text NOT NULL,
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, creator_id),
  CONSTRAINT shortlist_entries_creator_workspace_fk
    FOREIGN KEY (workspace_id, creator_id)
    REFERENCES public.creators (workspace_id, id) ON DELETE RESTRICT
);

CREATE INDEX shortlist_entries_workspace_added_at
  ON public.shortlist_entries (workspace_id, added_at DESC);

CREATE TABLE public.outreach_records (
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  creator_id text NOT NULL,
  campaign_id text,
  campaign_id_match text GENERATED ALWAYS AS (coalesce(campaign_id, '')) STORED,
  contact_method text NOT NULL CHECK (contact_method IN ('Email', 'Instagram DM')),
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'Draft' CHECK (
    status IN (
      'Draft',
      'Ready to Send',
      'Sent (Demo)',
      'Replied',
      'Interested',
      'Not Interested',
      'Follow-up Required'
    )
  ),
  brand_name text NOT NULL DEFAULT '',
  campaign_name text NOT NULL DEFAULT '',
  collaboration_description text NOT NULL DEFAULT '',
  offer text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT 'Friendly'
    CHECK (tone IN ('Professional', 'Friendly', 'Enthusiastic', 'Premium')),
  follow_up_date date,
  notes text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id),
  CONSTRAINT outreach_records_workspace_id_creator_unique
    UNIQUE (workspace_id, id, creator_id),
  CONSTRAINT outreach_records_workspace_id_campaign_match_unique
    UNIQUE (workspace_id, id, campaign_id_match),
  CONSTRAINT outreach_records_creator_workspace_fk
    FOREIGN KEY (workspace_id, creator_id)
    REFERENCES public.creators (workspace_id, id) ON DELETE RESTRICT,
  CONSTRAINT outreach_records_campaign_workspace_fk
    FOREIGN KEY (workspace_id, campaign_id)
    REFERENCES public.campaigns (workspace_id, id) ON DELETE RESTRICT
);

CREATE INDEX outreach_records_workspace_status_created_at
  ON public.outreach_records (workspace_id, status, created_at DESC);
CREATE INDEX outreach_records_workspace_campaign
  ON public.outreach_records (workspace_id, campaign_id);
CREATE INDEX outreach_records_workspace_creator
  ON public.outreach_records (workspace_id, creator_id);

CREATE TABLE public.outreach_events (
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  outreach_id text NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('created', 'message', 'status', 'note', 'follow-up')),
  text text NOT NULL,
  message_snapshot text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id),
  CONSTRAINT outreach_events_outreach_workspace_fk
    FOREIGN KEY (workspace_id, outreach_id)
    REFERENCES public.outreach_records (workspace_id, id) ON DELETE RESTRICT
);

CREATE INDEX outreach_events_workspace_outreach_created_at
  ON public.outreach_events (workspace_id, outreach_id, created_at);

CREATE TABLE public.message_templates (
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '',
  channel text NOT NULL CHECK (channel IN ('Email', 'Instagram DM')),
  subject text NOT NULL DEFAULT '',
  body text NOT NULL,
  custom boolean NOT NULL DEFAULT true,
  system_template_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id),
  CONSTRAINT message_templates_system_key_unique UNIQUE (workspace_id, system_template_key)
);

CREATE INDEX message_templates_workspace_created_at
  ON public.message_templates (workspace_id, created_at DESC);

CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('resend', 'instagram')),
  account_id text,
  username text,
  encrypted_access_token text,
  token_expires_at timestamptz,
  token_issued_at timestamptz,
  permissions text[] NOT NULL DEFAULT '{}',
  connected_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_connections_workspace_id_id_unique UNIQUE (workspace_id, id),
  CONSTRAINT integration_connections_workspace_account_unique UNIQUE (workspace_id, account_id),
  CONSTRAINT integration_connections_workspace_id_account_unique
    UNIQUE (workspace_id, id, account_id),
  CONSTRAINT integration_connections_account_shape CHECK (
    (provider = 'instagram' AND account_id IS NOT NULL AND username IS NOT NULL)
    OR (provider = 'resend' AND account_id IS NULL)
  )
);

CREATE UNIQUE INDEX integration_connections_workspace_resend_unique
  ON public.integration_connections (workspace_id)
  WHERE provider = 'resend';
CREATE INDEX integration_connections_workspace_provider
  ON public.integration_connections (workspace_id, provider);

CREATE TABLE public.email_delivery_attempts (
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  outreach_id text NOT NULL,
  creator_id text NOT NULL,
  campaign_id text,
  campaign_id_match text GENERATED ALWAYS AS (coalesce(campaign_id, '')) STORED,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  provider_message_id text,
  status text NOT NULL CHECK (
    status IN ('queued', 'sending', 'sent', 'delivered', 'delivery_delayed', 'failed', 'bounced')
  ),
  error_code text,
  error_message text,
  retryable boolean NOT NULL DEFAULT false,
  attempt integer NOT NULL CHECK (attempt > 0),
  idempotency_key text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id),
  CONSTRAINT email_delivery_attempts_idempotency_unique
    UNIQUE (workspace_id, idempotency_key),
  CONSTRAINT email_delivery_attempts_outreach_attempt_unique
    UNIQUE (workspace_id, outreach_id, attempt),
  CONSTRAINT email_delivery_attempts_provider_message_unique
    UNIQUE (workspace_id, provider_message_id),
  CONSTRAINT email_delivery_attempts_id_provider_message_unique
    UNIQUE (workspace_id, id, provider_message_id),
  CONSTRAINT email_delivery_attempts_outreach_creator_fk
    FOREIGN KEY (workspace_id, outreach_id, creator_id)
    REFERENCES public.outreach_records (workspace_id, id, creator_id) ON DELETE RESTRICT,
  CONSTRAINT email_delivery_attempts_outreach_campaign_fk
    FOREIGN KEY (workspace_id, outreach_id, campaign_id_match)
    REFERENCES public.outreach_records (workspace_id, id, campaign_id_match) ON DELETE RESTRICT,
  CONSTRAINT email_delivery_attempts_creator_workspace_fk
    FOREIGN KEY (workspace_id, creator_id)
    REFERENCES public.creators (workspace_id, id) ON DELETE RESTRICT,
  CONSTRAINT email_delivery_attempts_campaign_workspace_fk
    FOREIGN KEY (workspace_id, campaign_id)
    REFERENCES public.campaigns (workspace_id, id) ON DELETE RESTRICT
);

CREATE INDEX email_delivery_attempts_workspace_status_created_at
  ON public.email_delivery_attempts (workspace_id, status, created_at DESC);
CREATE INDEX email_delivery_attempts_workspace_outreach_attempt
  ON public.email_delivery_attempts (workspace_id, outreach_id, attempt DESC);
CREATE INDEX email_delivery_attempts_workspace_provider_message
  ON public.email_delivery_attempts (workspace_id, provider_message_id);

CREATE TABLE public.email_webhook_events (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  event_id text NOT NULL,
  delivery_attempt_id text NOT NULL,
  provider text NOT NULL DEFAULT 'resend' CHECK (provider = 'resend'),
  provider_message_id text NOT NULL,
  event_type text,
  event_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id),
  CONSTRAINT email_webhook_events_attempt_message_workspace_fk
    FOREIGN KEY (workspace_id, delivery_attempt_id, provider_message_id)
    REFERENCES public.email_delivery_attempts (workspace_id, id, provider_message_id)
    ON DELETE RESTRICT
);

CREATE INDEX email_webhook_events_workspace_received_at
  ON public.email_webhook_events (workspace_id, received_at DESC);
CREATE INDEX email_webhook_events_workspace_provider_message
  ON public.email_webhook_events (workspace_id, provider_message_id);

CREATE TABLE public.instagram_conversations (
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  integration_connection_id uuid NOT NULL,
  account_id text NOT NULL,
  recipient_id text NOT NULL,
  last_inbound_at timestamptz NOT NULL,
  last_message text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id),
  CONSTRAINT instagram_conversations_account_recipient_unique
    UNIQUE (workspace_id, account_id, recipient_id),
  CONSTRAINT instagram_conversations_connection_workspace_fk
    FOREIGN KEY (workspace_id, integration_connection_id, account_id)
    REFERENCES public.integration_connections (workspace_id, id, account_id)
    ON DELETE RESTRICT
);

CREATE INDEX instagram_conversations_workspace_last_inbound
  ON public.instagram_conversations (workspace_id, last_inbound_at DESC);

CREATE TABLE public.instagram_messages (
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  conversation_id text NOT NULL,
  provider_message_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivery_status text NOT NULL
    CHECK (delivery_status IN ('received', 'sending', 'sent', 'failed', 'unknown')),
  PRIMARY KEY (workspace_id, id),
  CONSTRAINT instagram_messages_provider_message_unique
    UNIQUE (workspace_id, provider_message_id),
  CONSTRAINT instagram_messages_conversation_workspace_fk
    FOREIGN KEY (workspace_id, conversation_id)
    REFERENCES public.instagram_conversations (workspace_id, id) ON DELETE RESTRICT
);

CREATE INDEX instagram_messages_workspace_conversation_created_at
  ON public.instagram_messages (workspace_id, conversation_id, created_at DESC);

COMMENT ON TABLE public.creators IS
  'Workspace-owned creator records only. The bundled demo catalogue is not stored here.';
COMMENT ON COLUMN public.workspaces.created_by IS
  'Immutable historical auth UUID; not a foreign key so attribution survives account deletion.';
COMMENT ON COLUMN public.workspace_members.invited_by IS
  'Immutable historical auth UUID; membership insertion is reserved for a future invitation flow.';
COMMENT ON COLUMN public.outreach_events.actor_user_id IS
  'Immutable historical auth UUID; retained without a user foreign key for audit history.';
COMMENT ON COLUMN public.integration_connections.encrypted_access_token IS
  'Application-encrypted provider token. Never expose this column through browser-facing clients.';
COMMENT ON TABLE public.email_webhook_events IS
  'Idempotent provider event receipts; raw provider payloads are intentionally not stored.';

CREATE FUNCTION app_private.is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members AS wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
  );
$$;
ALTER FUNCTION app_private.is_workspace_member(uuid) OWNER TO postgres;

CREATE FUNCTION app_private.has_workspace_role(
  p_workspace_id uuid,
  p_roles public.workspace_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members AS wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = ANY (p_roles)
  );
$$;
ALTER FUNCTION app_private.has_workspace_role(uuid, public.workspace_role[]) OWNER TO postgres;

CREATE FUNCTION app_private.shares_workspace_with(p_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members AS mine
    JOIN public.workspace_members AS theirs
      ON theirs.workspace_id = mine.workspace_id
    WHERE mine.user_id = auth.uid()
      AND theirs.user_id = p_other_user_id
  );
$$;
ALTER FUNCTION app_private.shares_workspace_with(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION app_private.is_workspace_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.has_workspace_role(uuid, public.workspace_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.shares_workspace_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_workspace_role(uuid, public.workspace_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.shares_workspace_with(uuid) TO authenticated;

-- The only path to initial owner membership is this atomic, caller-bound RPC.
CREATE FUNCTION public.create_workspace(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_name text := btrim(p_name);
  v_slug text := lower(btrim(p_slug));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create a workspace.'
      USING ERRCODE = '28000';
  END IF;

  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Workspace name must be between 2 and 100 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF v_slug IS NULL OR char_length(v_slug) NOT BETWEEN 3 AND 63
     OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Workspace slug must use 3-63 lowercase letters, digits, or single hyphens.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.profiles (id)
  VALUES (v_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (name, slug, created_by)
  VALUES (v_name, v_slug, v_user_id)
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_workspace_id, v_user_id, 'owner', v_user_id);

  RETURN v_workspace_id;
END;
$$;
ALTER FUNCTION public.create_workspace(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_workspace(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(text, text) TO authenticated;
COMMENT ON FUNCTION public.create_workspace(text, text) IS
  'Creates a workspace and its first owner membership atomically for auth.uid().';

CREATE FUNCTION app_private.prevent_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
  v_key text;
BEGIN
  FOREACH v_key IN ARRAY ARRAY[
    'id',
    'workspace_id',
    'user_id',
    'created_by',
    'invited_by',
    'added_by',
    'actor_user_id',
    'created_at',
    'joined_at',
    'added_at'
  ]
  LOOP
    IF v_old ? v_key AND v_old -> v_key IS DISTINCT FROM v_new -> v_key THEN
      RAISE EXCEPTION 'Column % is immutable.', v_key USING ERRCODE = '22000';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
ALTER FUNCTION app_private.prevent_identity_change() OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.prevent_identity_change() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app_private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
ALTER FUNCTION app_private.set_updated_at() OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app_private.prevent_last_owner_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    FOR v_workspace_id IN
      SELECT DISTINCT old_rows.workspace_id
      FROM old_rows
      WHERE old_rows.role = 'owner'::public.workspace_role
      ORDER BY old_rows.workspace_id
    LOOP
      UPDATE app_private.workspace_owner_guard
      SET version = version + 1
      WHERE workspace_id = v_workspace_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace owner guard is missing.'
          USING ERRCODE = '23503';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.workspace_members AS owner_row
        WHERE owner_row.workspace_id = v_workspace_id
          AND owner_row.role = 'owner'::public.workspace_role
      ) THEN
        RAISE EXCEPTION 'A workspace must retain at least one owner.'
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
  ELSIF TG_OP = 'UPDATE' THEN
    FOR v_workspace_id IN
      SELECT DISTINCT old_rows.workspace_id
      FROM old_rows
      JOIN new_rows ON new_rows.id = old_rows.id
      WHERE old_rows.role = 'owner'::public.workspace_role
        AND new_rows.role IS DISTINCT FROM old_rows.role
      ORDER BY old_rows.workspace_id
    LOOP
      UPDATE app_private.workspace_owner_guard
      SET version = version + 1
      WHERE workspace_id = v_workspace_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace owner guard is missing.'
          USING ERRCODE = '23503';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.workspace_members AS owner_row
        WHERE owner_row.workspace_id = v_workspace_id
          AND owner_row.role = 'owner'::public.workspace_role
      ) THEN
        RAISE EXCEPTION 'A workspace must retain at least one owner.'
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$;
ALTER FUNCTION app_private.prevent_last_owner_removal() OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.prevent_last_owner_removal() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION app_private.create_workspace_owner_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  INSERT INTO app_private.workspace_owner_guard (workspace_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;
ALTER FUNCTION app_private.create_workspace_owner_guard() OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.create_workspace_owner_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION app_private.prevent_workspace_members_truncate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'Workspace memberships cannot be truncated.'
    USING ERRCODE = '0A000';
END;
$$;
ALTER FUNCTION app_private.prevent_workspace_members_truncate() OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.prevent_workspace_members_truncate() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER workspaces_create_owner_guard
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION app_private.create_workspace_owner_guard();

CREATE TRIGGER workspace_members_prevent_truncate
  BEFORE TRUNCATE ON public.workspace_members
  FOR EACH STATEMENT EXECUTE FUNCTION app_private.prevent_workspace_members_truncate();

CREATE TRIGGER profiles_prevent_identity_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER workspaces_prevent_identity_change
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();
CREATE TRIGGER workspaces_set_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER workspace_members_prevent_identity_change
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();
CREATE TRIGGER workspace_members_prevent_last_owner_delete
  AFTER DELETE ON public.workspace_members
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION app_private.prevent_last_owner_removal();
CREATE TRIGGER workspace_members_prevent_last_owner_update
  AFTER UPDATE ON public.workspace_members
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION app_private.prevent_last_owner_removal();

CREATE TRIGGER creators_prevent_identity_change
  BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();
CREATE TRIGGER creators_set_updated_at
  BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER campaigns_prevent_identity_change
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();
CREATE TRIGGER campaigns_set_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER campaign_creators_prevent_identity_change
  BEFORE UPDATE ON public.campaign_creators
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();

CREATE TRIGGER shortlist_entries_prevent_identity_change
  BEFORE UPDATE ON public.shortlist_entries
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();

CREATE TRIGGER outreach_records_prevent_identity_change
  BEFORE UPDATE ON public.outreach_records
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();
CREATE TRIGGER outreach_records_set_updated_at
  BEFORE UPDATE ON public.outreach_records
  FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER outreach_events_prevent_identity_change
  BEFORE UPDATE ON public.outreach_events
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();

CREATE TRIGGER message_templates_prevent_identity_change
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();
CREATE TRIGGER message_templates_set_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER integration_connections_prevent_identity_change
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();
CREATE TRIGGER integration_connections_set_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER email_delivery_attempts_prevent_identity_change
  BEFORE UPDATE ON public.email_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();
CREATE TRIGGER email_delivery_attempts_set_updated_at
  BEFORE UPDATE ON public.email_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER instagram_conversations_prevent_identity_change
  BEFORE UPDATE ON public.instagram_conversations
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();
CREATE TRIGGER instagram_conversations_set_updated_at
  BEFORE UPDATE ON public.instagram_conversations
  FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER instagram_messages_prevent_identity_change
  BEFORE UPDATE ON public.instagram_messages
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_identity_change();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_creators FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shortlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlist_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_webhook_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY profiles_read_self_or_workspace_peers
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR app_private.shares_workspace_with(id));
CREATE POLICY profiles_insert_self
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_self
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY workspaces_read_member
  ON public.workspaces FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(id));
CREATE POLICY workspaces_update_admin
  ON public.workspaces FOR UPDATE TO authenticated
  USING (app_private.has_workspace_role(id, ARRAY['owner', 'admin']::public.workspace_role[]))
  WITH CHECK (app_private.has_workspace_role(id, ARRAY['owner', 'admin']::public.workspace_role[]));

CREATE POLICY workspace_members_read_member
  ON public.workspace_members FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));
CREATE POLICY workspace_members_update_admin
  ON public.workspace_members FOR UPDATE TO authenticated
  USING (
    role <> 'owner'
    AND (
      app_private.has_workspace_role(workspace_id, ARRAY['owner']::public.workspace_role[])
      OR (
        role IN ('member', 'viewer')
        AND app_private.has_workspace_role(workspace_id, ARRAY['admin']::public.workspace_role[])
      )
    )
  )
  WITH CHECK (
    role <> 'owner'
    AND (
      app_private.has_workspace_role(workspace_id, ARRAY['owner']::public.workspace_role[])
      OR (
        role IN ('member', 'viewer')
        AND app_private.has_workspace_role(workspace_id, ARRAY['admin']::public.workspace_role[])
      )
    )
  );
CREATE POLICY workspace_members_delete_admin
  ON public.workspace_members FOR DELETE TO authenticated
  USING (
    (
      role IN ('admin', 'member', 'viewer')
      AND app_private.has_workspace_role(workspace_id, ARRAY['owner']::public.workspace_role[])
    )
    OR (
      role IN ('member', 'viewer')
      AND app_private.has_workspace_role(workspace_id, ARRAY['admin']::public.workspace_role[])
    )
    OR (user_id = auth.uid() AND role IN ('member', 'viewer'))
  );

CREATE POLICY creators_read_member
  ON public.creators FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));
CREATE POLICY creators_insert_editor
  ON public.creators FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[])
  );
CREATE POLICY creators_update_editor
  ON public.creators FOR UPDATE TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]))
  WITH CHECK (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]));
CREATE POLICY creators_delete_editor
  ON public.creators FOR DELETE TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]));

CREATE POLICY campaigns_read_member
  ON public.campaigns FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));
CREATE POLICY campaigns_insert_editor
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[])
  );
CREATE POLICY campaigns_update_editor
  ON public.campaigns FOR UPDATE TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]))
  WITH CHECK (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]));
CREATE POLICY campaigns_delete_editor
  ON public.campaigns FOR DELETE TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]));

CREATE POLICY campaign_creators_read_member
  ON public.campaign_creators FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));
CREATE POLICY campaign_creators_insert_editor
  ON public.campaign_creators FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[])
  );
CREATE POLICY campaign_creators_delete_editor
  ON public.campaign_creators FOR DELETE TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]));

CREATE POLICY shortlist_entries_read_member
  ON public.shortlist_entries FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));
CREATE POLICY shortlist_entries_insert_editor
  ON public.shortlist_entries FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[])
  );
CREATE POLICY shortlist_entries_delete_editor
  ON public.shortlist_entries FOR DELETE TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]));

CREATE POLICY outreach_records_read_member
  ON public.outreach_records FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));
CREATE POLICY outreach_records_insert_editor
  ON public.outreach_records FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[])
  );
CREATE POLICY outreach_records_update_editor
  ON public.outreach_records FOR UPDATE TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]))
  WITH CHECK (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]));
CREATE POLICY outreach_records_delete_editor
  ON public.outreach_records FOR DELETE TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]));

CREATE POLICY outreach_events_read_member
  ON public.outreach_events FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));
CREATE POLICY outreach_events_insert_editor
  ON public.outreach_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[])
  );

CREATE POLICY message_templates_read_member
  ON public.message_templates FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));
CREATE POLICY message_templates_insert_editor
  ON public.message_templates FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[])
  );
CREATE POLICY message_templates_update_editor
  ON public.message_templates FOR UPDATE TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]))
  WITH CHECK (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]));
CREATE POLICY message_templates_delete_editor
  ON public.message_templates FOR DELETE TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'member']::public.workspace_role[]));

CREATE POLICY integration_connections_read_member
  ON public.integration_connections FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));

CREATE POLICY email_delivery_attempts_read_member
  ON public.email_delivery_attempts FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));
CREATE POLICY email_webhook_events_read_admin
  ON public.email_webhook_events FOR SELECT TO authenticated
  USING (app_private.has_workspace_role(workspace_id, ARRAY['owner', 'admin']::public.workspace_role[]));

CREATE POLICY instagram_conversations_read_member
  ON public.instagram_conversations FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));
CREATE POLICY instagram_messages_read_member
  ON public.instagram_messages FOR SELECT TO authenticated
  USING (app_private.is_workspace_member(workspace_id));

-- Grant only the operations intended for authenticated application sessions.
-- RLS remains authoritative for every granted operation.
REVOKE ALL ON TABLE
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.creators,
  public.campaigns,
  public.campaign_creators,
  public.shortlist_entries,
  public.outreach_records,
  public.outreach_events,
  public.message_templates,
  public.integration_connections,
  public.email_delivery_attempts,
  public.email_webhook_events,
  public.instagram_conversations,
  public.instagram_messages
FROM anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.workspaces TO authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.workspace_members TO authenticated;
REVOKE TRUNCATE ON TABLE public.workspace_members FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.creators,
  public.campaigns,
  public.outreach_records,
  public.message_templates
TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE
  public.campaign_creators,
  public.shortlist_entries
TO authenticated;
GRANT SELECT, INSERT ON TABLE public.outreach_events TO authenticated;
GRANT SELECT ON TABLE
  public.email_delivery_attempts,
  public.email_webhook_events,
  public.instagram_conversations,
  public.instagram_messages
TO authenticated;

-- Browser sessions can only read explicitly approved, non-secret connection metadata.
GRANT SELECT (
  id, workspace_id, provider, account_id, username, token_expires_at,
  token_issued_at, permissions, connected_at, created_by, created_at, updated_at
) ON TABLE public.integration_connections TO authenticated;

-- The service role is server-only and bypasses RLS by Supabase design.
-- Every server operation using it must independently authenticate the user,
-- resolve the workspace, and authorize the requested operation.
GRANT SELECT, INSERT, UPDATE ON TABLE public.integration_connections TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.email_delivery_attempts TO service_role;
GRANT SELECT, INSERT ON TABLE public.email_webhook_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE
  public.instagram_conversations,
  public.instagram_messages
TO service_role;
