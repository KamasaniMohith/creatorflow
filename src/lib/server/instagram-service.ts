import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import type { InstagramConversationSummary } from "@/types/integrations";

const META_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v27.0";
const REQUIRED_PERMISSIONS = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
];

interface InstagramConnection {
  accountId: string;
  username: string;
  encryptedAccessToken: string;
  tokenExpiresAt: string;
  tokenIssuedAt: string;
  permissions: string[];
}

function encryptionKey(): Buffer {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY ?? "";
  if (!/^[\da-f]{64}$/i.test(value)) {
    throw new Error("Instagram token encryption is not configured.");
  }
  return Buffer.from(value, "hex");
}

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptToken(value: string): string {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Stored Instagram credentials could not be decrypted.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function isInstagramConfigured(): boolean {
  return Boolean(
    process.env.META_INSTAGRAM_APP_ID &&
      process.env.META_INSTAGRAM_APP_SECRET &&
      process.env.META_INSTAGRAM_REDIRECT_URI &&
      process.env.META_WEBHOOK_VERIFY_TOKEN &&
      process.env.INTEGRATION_ENCRYPTION_KEY,
  );
}

export async function beginInstagramAuthorization(): Promise<string> {
  if (!isInstagramConfigured()) {
    throw new Error("Instagram setup is incomplete.");
  }
  const state = randomBytes(32).toString("base64url");
  const database = await getDatabase();
  await database.execute({
    sql: "DELETE FROM instagram_oauth_states WHERE expires_at < ?",
    args: [new Date().toISOString()],
  });
  await database.execute({
    sql: "INSERT INTO instagram_oauth_states (state_hash, expires_at) VALUES (?, ?)",
    args: [
      createHash("sha256").update(state).digest("hex"),
      new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ],
  });

  const authorizationUrl = new URL("https://www.instagram.com/oauth/authorize");
  authorizationUrl.searchParams.set("client_id", process.env.META_INSTAGRAM_APP_ID!);
  authorizationUrl.searchParams.set("redirect_uri", process.env.META_INSTAGRAM_REDIRECT_URI!);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", REQUIRED_PERMISSIONS.join(","));
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("enable_fb_login", "false");
  return authorizationUrl.toString();
}

interface OAuthTokenResponse {
  access_token?: unknown;
  user_id?: unknown;
  permissions?: unknown;
  expires_in?: unknown;
  error?: unknown;
}

function responseData(value: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(value.data)) {
    const first = value.data[0];
    if (typeof first === "object" && first !== null) {
      return first as Record<string, unknown>;
    }
  }
  return value;
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof result !== "object" || result === null) {
    throw new Error("Meta authorization request failed.");
  }
  return result as Record<string, unknown>;
}

export async function completeInstagramAuthorization(
  code: string,
  state: string,
): Promise<void> {
  if (!isInstagramConfigured()) {
    throw new Error("Instagram setup is incomplete.");
  }
  const database = await getDatabase();
  const tx = await database.transaction("write");
  const stateHash = createHash("sha256").update(state).digest("hex");
  try {
    const storedState = await tx.execute({
      sql: "SELECT expires_at FROM instagram_oauth_states WHERE state_hash = ?",
      args: [stateHash],
    });
    const expiresAt = storedState.rows[0]?.expires_at;
    if (!expiresAt || Date.parse(String(expiresAt)) < Date.now()) {
      await tx.rollback();
      throw new Error("Instagram authorization state expired or was already used.");
    }
    await tx.execute({
      sql: "DELETE FROM instagram_oauth_states WHERE state_hash = ?",
      args: [stateHash],
    });
    await tx.commit();
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  }

  const form = new FormData();
  form.set("client_id", process.env.META_INSTAGRAM_APP_ID!);
  form.set("client_secret", process.env.META_INSTAGRAM_APP_SECRET!);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", process.env.META_INSTAGRAM_REDIRECT_URI!);
  form.set("code", code);
  const shortToken = responseData(await fetchJson(
    "https://api.instagram.com/oauth/access_token",
    { method: "POST", body: form },
  )) as OAuthTokenResponse;
  if (
    typeof shortToken.access_token !== "string" ||
    (typeof shortToken.user_id !== "string" && typeof shortToken.user_id !== "number")
  ) {
    throw new Error("Meta did not return an Instagram account token.");
  }

  const grantedPermissions = Array.isArray(shortToken.permissions)
    ? shortToken.permissions.filter((permission): permission is string => typeof permission === "string")
    : typeof shortToken.permissions === "string"
      ? shortToken.permissions.split(",")
      : [];
  if (!REQUIRED_PERMISSIONS.every((permission) => grantedPermissions.includes(permission))) {
    throw new Error("The Instagram account did not grant messaging permissions.");
  }

  const tokenUrl = new URL("https://graph.instagram.com/access_token");
  tokenUrl.searchParams.set("grant_type", "ig_exchange_token");
  tokenUrl.searchParams.set("client_secret", process.env.META_INSTAGRAM_APP_SECRET!);
  tokenUrl.searchParams.set("access_token", shortToken.access_token);
  const longToken = responseData(await fetchJson(tokenUrl.toString()));
  if (
    typeof longToken.access_token !== "string" ||
    typeof longToken.expires_in !== "number"
  ) {
    throw new Error("Meta did not return a long-lived Instagram token.");
  }

  const profileUrl = new URL(`https://graph.instagram.com/${META_API_VERSION}/me`);
  profileUrl.searchParams.set("fields", "user_id,username");
  profileUrl.searchParams.set("access_token", longToken.access_token);
  const profile = responseData(await fetchJson(profileUrl.toString()));
  const accountId = String(profile.user_id ?? shortToken.user_id);
  if (!accountId || typeof profile.username !== "string") {
    throw new Error("Meta did not return the Instagram professional account profile.");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + longToken.expires_in * 1000).toISOString();
  await database.execute({
    sql: `INSERT INTO instagram_connection (
      id, account_id, username, encrypted_access_token, token_expires_at,
      token_issued_at, permissions_json, connected_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      account_id = excluded.account_id,
      username = excluded.username,
      encrypted_access_token = excluded.encrypted_access_token,
      token_expires_at = excluded.token_expires_at,
      token_issued_at = excluded.token_issued_at,
      permissions_json = excluded.permissions_json,
      connected_at = excluded.connected_at`,
    args: [
      accountId,
      profile.username,
      encryptToken(longToken.access_token),
      expiresAt,
      now.toISOString(),
      JSON.stringify(grantedPermissions),
      now.toISOString(),
    ],
  });
}

async function getConnection(): Promise<InstagramConnection | null> {
  const database = await getDatabase();
  const result = await database.execute(
    `SELECT account_id, username, encrypted_access_token, token_expires_at,
            token_issued_at, permissions_json FROM instagram_connection WHERE id = 1`,
  );
  const row = result.rows[0];
  if (!row) return null;
  let permissions: string[];
  try {
    const parsed: unknown = JSON.parse(String(row.permissions_json));
    permissions = Array.isArray(parsed)
      ? parsed.filter((permission): permission is string => typeof permission === "string")
      : [];
  } catch {
    permissions = [];
  }
  return {
    accountId: String(row.account_id),
    username: String(row.username),
    encryptedAccessToken: String(row.encrypted_access_token),
    tokenExpiresAt: String(row.token_expires_at),
    tokenIssuedAt: String(row.token_issued_at),
    permissions,
  };
}

async function getValidAccessToken(connection: InstagramConnection): Promise<string> {
  let token = decryptToken(connection.encryptedAccessToken);
  if (Date.parse(connection.tokenExpiresAt) <= Date.now()) {
    throw new Error("The Instagram access token expired. Reconnect the account.");
  }
  const issuedAt = Date.parse(connection.tokenIssuedAt);
  const nearExpiry = Date.parse(connection.tokenExpiresAt) - Date.now() < 7 * 24 * 60 * 60 * 1000;
  const oldEnoughToRefresh = Date.now() - issuedAt >= 24 * 60 * 60 * 1000;
  if (!nearExpiry || !oldEnoughToRefresh) return token;

  const refreshUrl = new URL("https://graph.instagram.com/refresh_access_token");
  refreshUrl.searchParams.set("grant_type", "ig_refresh_token");
  refreshUrl.searchParams.set("access_token", token);
  const refreshed = await fetchJson(refreshUrl.toString());
  if (
    typeof refreshed.access_token !== "string" ||
    typeof refreshed.expires_in !== "number"
  ) {
    throw new Error("Meta did not refresh the Instagram access token.");
  }
  token = refreshed.access_token;
  const issued = new Date().toISOString();
  await (await getDatabase()).execute({
    sql: `UPDATE instagram_connection SET encrypted_access_token = ?,
          token_expires_at = ?, token_issued_at = ? WHERE id = 1`,
    args: [
      encryptToken(token),
      new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      issued,
    ],
  });
  return token;
}

export async function listInstagramConversations(): Promise<InstagramConversationSummary[]> {
  const database = await getDatabase();
  const result = await database.execute(
    `SELECT id, recipient_id, last_inbound_at, last_message
     FROM instagram_conversations ORDER BY last_inbound_at DESC LIMIT 50`,
  );
  const conversations: InstagramConversationSummary[] = [];
  for (const row of result.rows) {
    const id = String(row.id);
    const lastInboundAt = String(row.last_inbound_at);
    const messages = await database.execute({
      sql: `SELECT id, direction, message_text, created_at
            FROM instagram_messages WHERE conversation_id = ?
            ORDER BY created_at DESC LIMIT 20`,
      args: [id],
    });
    conversations.push({
      id,
      recipientId: String(row.recipient_id),
      lastInboundAt,
      lastMessage: String(row.last_message),
      eligibleToReply: Date.now() - Date.parse(lastInboundAt) <= 24 * 60 * 60 * 1000,
      messages: messages.rows
        .map((message) => ({
          id: String(message.id),
          direction: String(message.direction) as "inbound" | "outbound",
          text: String(message.message_text),
          createdAt: String(message.created_at),
        }))
        .reverse(),
    });
  }
  return conversations;
}

export async function sendInstagramReply(
  conversationId: string,
  text: string,
  requestId: string,
): Promise<{ messageId: string; sentAt: string }> {
  const database = await getDatabase();
  const connection = await getConnection();
  if (!connection) throw new Error("Connect an Instagram professional account first.");
  if (!REQUIRED_PERMISSIONS.every((permission) => connection.permissions.includes(permission))) {
    throw new Error("The connected account is missing Instagram messaging permissions.");
  }
  const conversationResult = await database.execute({
    sql: `SELECT recipient_id, last_inbound_at FROM instagram_conversations
          WHERE id = ? AND account_id = ?`,
    args: [conversationId, connection.accountId],
  });
  const conversation = conversationResult.rows[0];
  if (!conversation) throw new Error("The Instagram conversation was not found.");
  const lastInboundAt = Date.parse(String(conversation.last_inbound_at));
  if (!Number.isFinite(lastInboundAt) || Date.now() - lastInboundAt > 24 * 60 * 60 * 1000) {
    throw new Error("The 24-hour messaging window has expired. Manual outreach is required.");
  }
  if (Buffer.byteLength(text, "utf8") > 1000) {
    throw new Error("Instagram reply text must be 1,000 UTF-8 bytes or less.");
  }

  const existing = await database.execute({
    sql: `SELECT provider_message_id, delivery_status, created_at
          FROM instagram_messages WHERE id = ?`,
    args: [requestId],
  });
  if (existing.rows[0]) {
    if (String(existing.rows[0].delivery_status) === "sent") {
      return {
        messageId: String(existing.rows[0].provider_message_id),
        sentAt: String(existing.rows[0].created_at),
      };
    }
    throw new Error("A reply attempt with this ID already exists. Check Instagram before trying again.");
  }

  const token = await getValidAccessToken(connection);
  const pendingId = `pending:${requestId}`;
  const sentAt = new Date().toISOString();
  const recipientId = String(conversation.recipient_id);
  await database.execute({
    sql: `INSERT INTO instagram_messages (
      id, conversation_id, provider_message_id, direction, message_text, created_at, delivery_status
    ) VALUES (?, ?, ?, 'outbound', ?, ?, 'sending')`,
    args: [requestId, conversationId, pendingId, text, sentAt],
  });

  let response: Response;
  try {
    const endpoint = `https://graph.instagram.com/${META_API_VERSION}/${connection.accountId}/messages`;
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
      cache: "no-store",
    });
  } catch {
    await database.execute({
      sql: "UPDATE instagram_messages SET delivery_status = 'unknown' WHERE id = ?",
      args: [requestId],
    });
    throw new Error("The provider outcome is unknown. Check Instagram before attempting another reply.");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof payload !== "object" || payload === null) {
    await database.execute({
      sql: "UPDATE instagram_messages SET delivery_status = 'failed' WHERE id = ?",
      args: [requestId],
    });
    throw new Error("Meta rejected the Instagram reply. Check account permissions and eligibility.");
  }
  const messageId =
    "message_id" in payload && typeof payload.message_id === "string"
      ? payload.message_id
      : "id" in payload && typeof payload.id === "string"
        ? payload.id
        : null;
  if (!messageId) {
    await database.execute({
      sql: "UPDATE instagram_messages SET delivery_status = 'unknown' WHERE id = ?",
      args: [requestId],
    });
    throw new Error("Meta did not confirm the Instagram reply. Check Instagram before attempting another reply.");
  }
  await database.execute({
    sql: `UPDATE instagram_messages
          SET provider_message_id = ?, delivery_status = 'sent' WHERE id = ?`,
    args: [messageId, requestId],
  });
  await database.execute({
    sql: "UPDATE instagram_conversations SET last_message = ?, updated_at = ? WHERE id = ?",
    args: [text, sentAt, conversationId],
  });
  return { messageId, sentAt };
}

export async function storeInstagramWebhook(payload: unknown): Promise<void> {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("object" in payload) ||
    payload.object !== "instagram" ||
    !("entry" in payload) ||
    !Array.isArray(payload.entry)
  ) {
    throw new Error("Unsupported Instagram webhook payload.");
  }
  const database = await getDatabase();
  const transaction = await database.transaction("write");
  try {
    for (const entry of payload.entry) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        !("id" in entry) ||
        typeof entry.id !== "string" ||
        !("messaging" in entry) ||
        !Array.isArray(entry.messaging)
      ) {
        continue;
      }
      const accountId = entry.id;
      for (const event of entry.messaging) {
        if (
          typeof event !== "object" ||
          event === null ||
          !("sender" in event) ||
          typeof event.sender !== "object" ||
          event.sender === null ||
          !("id" in event.sender) ||
          typeof event.sender.id !== "string" ||
          !("recipient" in event) ||
          typeof event.recipient !== "object" ||
          event.recipient === null ||
          !("id" in event.recipient) ||
          typeof event.recipient.id !== "string" ||
          !("message" in event) ||
          typeof event.message !== "object" ||
          event.message === null ||
          !("mid" in event.message) ||
          typeof event.message.mid !== "string" ||
          !("text" in event.message) ||
          typeof event.message.text !== "string" ||
          ("is_echo" in event.message && event.message.is_echo === true)
        ) {
          continue;
        }
        const account = await transaction.execute({
          sql: "SELECT account_id FROM instagram_connection WHERE id = 1",
        });
        if (String(account.rows[0]?.account_id ?? "") !== accountId) continue;

        const senderId = event.sender.id;
        const recipientAccountId = event.recipient.id;
        if (recipientAccountId !== accountId || senderId === accountId) continue;
        const timestamp =
          "timestamp" in event && typeof event.timestamp === "number"
            ? event.timestamp
            : Date.now();
        const createdAt = new Date(timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp).toISOString();
        const conversationId = createHash("sha256")
          .update(`${accountId}:${senderId}`)
          .digest("hex");
        const messageRowId = randomUUID();
        const inserted = await transaction.execute({
          sql: `INSERT OR IGNORE INTO instagram_messages (
            id, conversation_id, provider_message_id, direction, message_text, created_at, delivery_status
          ) VALUES (?, ?, ?, 'inbound', ?, ?, 'received')`,
          args: [messageRowId, conversationId, event.message.mid, event.message.text, createdAt],
        });
        if (inserted.rowsAffected === 0) continue;

        await transaction.execute({
          sql: `INSERT INTO instagram_conversations (
            id, account_id, recipient_id, last_inbound_at, last_message, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(account_id, recipient_id) DO UPDATE SET
            last_inbound_at = CASE WHEN excluded.last_inbound_at > instagram_conversations.last_inbound_at
              THEN excluded.last_inbound_at ELSE instagram_conversations.last_inbound_at END,
            last_message = CASE WHEN excluded.last_inbound_at > instagram_conversations.last_inbound_at
              THEN excluded.last_message ELSE instagram_conversations.last_message END,
            updated_at = excluded.updated_at`,
          args: [conversationId, accountId, senderId, createdAt, event.message.text, createdAt],
        });
      }
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function disconnectInstagram(): Promise<void> {
  const database = await getDatabase();
  await database.execute("DELETE FROM instagram_connection WHERE id = 1");
}

export function getInstagramWebhookSecret(): string | null {
  return process.env.META_INSTAGRAM_APP_SECRET ?? null;
}
