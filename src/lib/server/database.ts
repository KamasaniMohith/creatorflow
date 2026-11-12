import "server-only";

import { createClient, type Client } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

let client: Client | undefined;
let schemaReady: Promise<void> | undefined;

async function getClient(): Promise<Client> {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;
  if (url && !url.startsWith("file:") && !authToken) {
    throw new Error("A database authentication token is required for the remote database.");
  }

  if (url?.startsWith("file:")) {
    throw new Error("Pass a relative or remote database URL, not a file: DATABASE_URL.");
  }

  if (url) {
    client = createClient({ url, authToken });
  } else {
    const directory = join(process.cwd(), ".creatorflow");
    await mkdir(directory, { recursive: true });
    client = createClient({
      url: `file:${join(directory, "outreach.db").replaceAll("\\", "/")}`,
    });
  }
  return client;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS email_deliveries (
    id TEXT PRIMARY KEY,
    outreach_id TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    campaign_id TEXT,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    provider_message_id TEXT,
    status TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT,
    retryable INTEGER NOT NULL DEFAULT 0,
    attempt INTEGER NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    sent_at TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(outreach_id, attempt)
  );
  CREATE INDEX IF NOT EXISTS email_deliveries_provider_id
    ON email_deliveries(provider_message_id);
  CREATE INDEX IF NOT EXISTS email_deliveries_outreach
    ON email_deliveries(outreach_id, attempt DESC);
  CREATE TABLE IF NOT EXISTS resend_webhook_events (
    event_id TEXT PRIMARY KEY,
    received_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS instagram_oauth_states (
    state_hash TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS instagram_connection (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    account_id TEXT NOT NULL,
    username TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    token_expires_at TEXT NOT NULL,
    token_issued_at TEXT NOT NULL,
    permissions_json TEXT NOT NULL,
    connected_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS instagram_conversations (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    last_inbound_at TEXT NOT NULL,
    last_message TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(account_id, recipient_id)
  );
  CREATE TABLE IF NOT EXISTS instagram_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    provider_message_id TEXT NOT NULL UNIQUE,
    direction TEXT NOT NULL,
    message_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    delivery_status TEXT NOT NULL
  );
`;

export async function getDatabase(): Promise<Client> {
  const database = await getClient();
  if (!schemaReady) {
    schemaReady = database.executeMultiple(SCHEMA);
  }
  await schemaReady;
  return database;
}
