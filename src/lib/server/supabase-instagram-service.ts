import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createAdminClient } from "@/lib/server/supabase-admin";
import type { InstagramConversationSummary } from "@/types/integrations";

const META_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v27.0";
const REQUIRED_PERMISSIONS = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
];
const OAUTH_COOKIE_NAME = "creatorflow_ig_oauth";

interface InstagramConnection {
  id: string;
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
      process.env.INTEGRATION_ENCRYPTION_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function signOAuthPayload(payload: string): string {
  const stateKey = createHmac("sha256", encryptionKey())
    .update("creatorflow-instagram-oauth-state")
    .digest();
  return createHmac("sha256", stateKey).update(payload).digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function oauthCookieValue(state: string, workspaceId: string, userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      state,
      workspaceId,
      userId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    }),
  ).toString("base64url");
  return `${payload}.${signOAuthPayload(payload)}`;
}

export function instagramOAuthCookieName(): string {
  return OAUTH_COOKIE_NAME;
}

export function verifyInstagramOAuthCookie(
  cookieValue: string | undefined,
  state: string | null,
): { workspaceId: string; userId: string } | null {
  if (!cookieValue || !state) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature || !constantTimeEqual(signature, signOAuthPayload(payload))) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      typeof value !== "object" ||
      value === null ||
      !("state" in value) ||
      value.state !== state ||
      !("workspaceId" in value) ||
      typeof value.workspaceId !== "string" ||
      !("userId" in value) ||
      typeof value.userId !== "string" ||
      !("expiresAt" in value) ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt < Date.now()
    ) {
      return null;
    }
    return { workspaceId: value.workspaceId, userId: value.userId };
  } catch {
    return null;
  }
}

export function createInstagramOAuthCookieValue(
  state: string,
  workspaceId: string,
  userId: string,
): string {
  return oauthCookieValue(state, workspaceId, userId);
}

export async function beginWorkspaceInstagramAuthorization(
  workspaceId: string,
  userId: string,
): Promise<{ authorizationUrl: string; cookieValue: string }> {
  if (!isInstagramConfigured()) {
    throw new Error("Instagram setup is incomplete.");
  }
  const state = randomBytes(32).toString("base64url");
  const authorizationUrl = new URL("https://www.instagram.com/oauth/authorize");
  authorizationUrl.searchParams.set("client_id", process.env.META_INSTAGRAM_APP_ID!);
  authorizationUrl.searchParams.set("redirect_uri", process.env.META_INSTAGRAM_REDIRECT_URI!);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", REQUIRED_PERMISSIONS.join(","));
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("enable_fb_login", "false");
  return {
    authorizationUrl: authorizationUrl.toString(),
    cookieValue: oauthCookieValue(state, workspaceId, userId),
  };
}

interface OAuthTokenResponse {
  access_token?: unknown;
  user_id?: unknown;
  permissions?: unknown;
  expires_in?: unknown;
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

export async function completeWorkspaceInstagramAuthorization(
  code: string,
  state: string,
  cookieValue: string | undefined,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const oauthState = verifyInstagramOAuthCookie(cookieValue, state);
  if (
    !oauthState ||
    oauthState.workspaceId !== workspaceId ||
    oauthState.userId !== userId
  ) {
    throw new Error("Instagram authorization state is invalid or expired.");
  }
  if (!isInstagramConfigured()) {
    throw new Error("Instagram setup is incomplete.");
  }

  const form = new FormData();
  form.set("client_id", process.env.META_INSTAGRAM_APP_ID!);
  form.set("client_secret", process.env.META_INSTAGRAM_APP_SECRET!);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", process.env.META_INSTAGRAM_REDIRECT_URI!);
  form.set("code", code);
  const shortToken = responseData(
    await fetchJson("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: form,
    }),
  ) as OAuthTokenResponse;
  if (
    typeof shortToken.access_token !== "string" ||
    (typeof shortToken.user_id !== "string" &&
      typeof shortToken.user_id !== "number")
  ) {
    throw new Error("Meta did not return an Instagram account token.");
  }

  const grantedPermissions = Array.isArray(shortToken.permissions)
    ? shortToken.permissions.filter(
        (permission): permission is string => typeof permission === "string",
      )
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
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("integration_connections")
    .select("id, account_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "instagram")
    .maybeSingle();
  if (existingError) throw new Error("Unable to check the workspace Instagram connection.");

  const values = {
    account_id: accountId,
    username: profile.username,
    encrypted_access_token: encryptToken(longToken.access_token),
    token_expires_at: expiresAt,
    token_issued_at: now.toISOString(),
    permissions: grantedPermissions,
    connected_at: now.toISOString(),
  };
  const result = existing
    ? await supabase
        .from("integration_connections")
        .update(values)
        .eq("workspace_id", workspaceId)
        .eq("id", existing.id)
    : await supabase.from("integration_connections").insert({
        ...values,
        id: randomUUID(),
        workspace_id: workspaceId,
        provider: "instagram",
        created_by: userId,
      });
  if (result.error) {
    console.error("Unable to persist the workspace Instagram connection.", result.error);
    throw new Error(
      "Instagram connection could not be saved. Existing conversation records may prevent changing accounts.",
    );
  }
}

async function getWorkspaceConnection(
  workspaceId: string,
): Promise<InstagramConnection | null> {
  const { data, error } = await createAdminClient()
    .from("integration_connections")
    .select(
      "id, account_id, username, encrypted_access_token, token_expires_at, token_issued_at, permissions",
    )
    .eq("workspace_id", workspaceId)
    .eq("provider", "instagram")
    .maybeSingle();
  if (error) {
    console.error("Unable to load encrypted workspace Instagram connection.", error);
    throw new Error("Instagram connection could not be loaded.");
  }
  if (
    !data ||
    typeof data.encrypted_access_token !== "string" ||
    typeof data.token_expires_at !== "string" ||
    typeof data.token_issued_at !== "string"
  ) {
    return null;
  }
  return {
    id: String(data.id),
    accountId: String(data.account_id),
    username: String(data.username),
    encryptedAccessToken: data.encrypted_access_token,
    tokenExpiresAt: data.token_expires_at,
    tokenIssuedAt: data.token_issued_at,
    permissions: Array.isArray(data.permissions)
      ? data.permissions.filter(
          (permission: unknown): permission is string => typeof permission === "string",
        )
      : [],
  };
}

async function getValidAccessToken(
  connection: InstagramConnection & { workspaceId: string },
): Promise<string> {
  let token = decryptToken(connection.encryptedAccessToken);
  if (Date.parse(connection.tokenExpiresAt) <= Date.now()) {
    throw new Error("The Instagram access token expired. Reconnect the account.");
  }
  const issuedAt = Date.parse(connection.tokenIssuedAt);
  const nearExpiry =
    Date.parse(connection.tokenExpiresAt) - Date.now() <
    7 * 24 * 60 * 60 * 1000;
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
  const tokenIssuedAt = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("integration_connections")
    .update({
      encrypted_access_token: encryptToken(token),
      token_expires_at: new Date(
        Date.now() + refreshed.expires_in * 1000,
      ).toISOString(),
      token_issued_at: tokenIssuedAt,
    })
    .eq("workspace_id", connection.workspaceId)
    .eq("id", connection.id);
  if (error) throw new Error("The refreshed Instagram token could not be saved.");
  return token;
}

interface WorkspaceInstagramConnection extends InstagramConnection {
  workspaceId: string;
}

export async function listWorkspaceInstagramConversations(
  workspaceId: string,
): Promise<InstagramConversationSummary[]> {
  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("instagram_conversations")
    .select("id, recipient_id, last_inbound_at, last_message")
    .eq("workspace_id", workspaceId)
    .order("last_inbound_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Instagram conversations could not be loaded.");
  const conversations: InstagramConversationSummary[] = [];
  for (const row of rows ?? []) {
    const { data: messages, error: messageError } = await supabase
      .from("instagram_messages")
      .select("id, direction, message_text, created_at")
      .eq("workspace_id", workspaceId)
      .eq("conversation_id", row.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (messageError) throw new Error("Instagram message history could not be loaded.");
    const lastInboundAt = String(row.last_inbound_at);
    conversations.push({
      id: String(row.id),
      recipientId: String(row.recipient_id),
      lastInboundAt,
      lastMessage: String(row.last_message),
      eligibleToReply:
        Date.now() - Date.parse(lastInboundAt) <= 24 * 60 * 60 * 1000,
      messages: (messages ?? [])
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

export async function sendWorkspaceInstagramReply(
  workspaceId: string,
  conversationId: string,
  text: string,
  requestId: string,
): Promise<{ messageId: string; sentAt: string }> {
  const supabase = createAdminClient();
  const connection = await getWorkspaceConnection(workspaceId);
  if (!connection) throw new Error("Connect an Instagram professional account first.");
  const workspaceConnection: WorkspaceInstagramConnection = {
    ...connection,
    workspaceId,
  };
  if (!REQUIRED_PERMISSIONS.every((permission) => connection.permissions.includes(permission))) {
    throw new Error("The connected account is missing Instagram messaging permissions.");
  }
  const { data: conversation, error: conversationError } = await supabase
    .from("instagram_conversations")
    .select("recipient_id, last_inbound_at")
    .eq("workspace_id", workspaceId)
    .eq("id", conversationId)
    .eq("account_id", connection.accountId)
    .maybeSingle();
  if (conversationError) throw new Error("The Instagram conversation could not be checked.");
  if (!conversation) throw new Error("The Instagram conversation was not found.");
  const lastInboundAt = Date.parse(String(conversation.last_inbound_at));
  if (
    !Number.isFinite(lastInboundAt) ||
    Date.now() - lastInboundAt > 24 * 60 * 60 * 1000
  ) {
    throw new Error("The 24-hour messaging window has expired. Manual outreach is required.");
  }
  if (Buffer.byteLength(text, "utf8") > 1000) {
    throw new Error("Instagram reply text must be 1,000 UTF-8 bytes or less.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("instagram_messages")
    .select("provider_message_id, delivery_status, created_at")
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .maybeSingle();
  if (existingError) throw new Error("The Instagram reply attempt could not be checked.");
  if (existing) {
    if (existing.delivery_status === "sent") {
      return {
        messageId: String(existing.provider_message_id),
        sentAt: String(existing.created_at),
      };
    }
    throw new Error("A reply attempt with this ID already exists. Check Instagram before trying again.");
  }

  const token = await getValidAccessToken(workspaceConnection);
  const pendingId = `pending:${requestId}`;
  const sentAt = new Date().toISOString();
  const { error: insertError } = await supabase.from("instagram_messages").insert({
    id: requestId,
    workspace_id: workspaceId,
    conversation_id: conversationId,
    provider_message_id: pendingId,
    direction: "outbound",
    message_text: text,
    created_at: sentAt,
    delivery_status: "sending",
  });
  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error("This Instagram reply attempt already exists. Check its status before retrying.");
    }
    throw new Error("The Instagram reply attempt could not be recorded.");
  }

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
        recipient: { id: String(conversation.recipient_id) },
        message: { text },
      }),
      cache: "no-store",
    });
  } catch {
    await supabase
      .from("instagram_messages")
      .update({ delivery_status: "unknown" })
      .eq("workspace_id", workspaceId)
      .eq("id", requestId);
    throw new Error("The provider outcome is unknown. Check Instagram before attempting another reply.");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof payload !== "object" || payload === null) {
    await supabase
      .from("instagram_messages")
      .update({ delivery_status: "failed" })
      .eq("workspace_id", workspaceId)
      .eq("id", requestId);
    throw new Error("Meta rejected the Instagram reply. Check account permissions and eligibility.");
  }
  const messageId =
    "message_id" in payload && typeof payload.message_id === "string"
      ? payload.message_id
      : "id" in payload && typeof payload.id === "string"
        ? payload.id
        : null;
  if (!messageId) {
    await supabase
      .from("instagram_messages")
      .update({ delivery_status: "unknown" })
      .eq("workspace_id", workspaceId)
      .eq("id", requestId);
    throw new Error("Meta did not confirm the Instagram reply. Check Instagram before attempting another reply.");
  }

  const { error: updateError } = await supabase
    .from("instagram_messages")
    .update({ provider_message_id: messageId, delivery_status: "sent" })
    .eq("workspace_id", workspaceId)
    .eq("id", requestId);
  if (updateError) {
    throw new Error("Meta accepted the reply, but its provider status could not be saved. Do not retry until you check Instagram.");
  }
  await supabase
    .from("instagram_conversations")
    .update({ last_message: text, updated_at: sentAt })
    .eq("workspace_id", workspaceId)
    .eq("id", conversationId);
  return { messageId, sentAt };
}

export async function disconnectWorkspaceInstagram(
  workspaceId: string,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("integration_connections")
    .update({
      encrypted_access_token: null,
      token_expires_at: null,
      token_issued_at: null,
      permissions: [],
    })
    .eq("workspace_id", workspaceId)
    .eq("provider", "instagram");
  if (error) throw new Error("The Instagram connection could not be disconnected.");
}

export async function storeWorkspaceInstagramWebhook(payload: unknown): Promise<void> {
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

  const supabase = createAdminClient();
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
    const { data: connections, error: connectionError } = await supabase
      .from("integration_connections")
      .select("id, workspace_id")
      .eq("provider", "instagram")
      .eq("account_id", accountId)
      .not("encrypted_access_token", "is", null);
    if (connectionError) throw new Error("Instagram webhook account could not be resolved.");
    if ((connections ?? []).length !== 1) {
      if ((connections ?? []).length > 1) {
        console.error("Instagram webhook account is connected to multiple workspaces.");
      }
      continue;
    }
    const connection = connections![0];

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
        event.recipient.id !== accountId ||
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
      const senderId = event.sender.id;
      if (senderId === accountId) continue;
      const timestamp =
        "timestamp" in event && typeof event.timestamp === "number"
          ? event.timestamp
          : Date.now();
      const createdAt = new Date(
        timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp,
      ).toISOString();
      const conversationId = createHash("sha256")
        .update(`${accountId}:${senderId}`)
        .digest("hex");
      const { error: conversationError } = await supabase
        .from("instagram_conversations")
        .upsert(
          {
            id: conversationId,
            workspace_id: connection.workspace_id,
            integration_connection_id: connection.id,
            account_id: accountId,
            recipient_id: senderId,
            last_inbound_at: createdAt,
            last_message: event.message.text,
            updated_at: createdAt,
          },
          {
            onConflict: "workspace_id,account_id,recipient_id",
            ignoreDuplicates: true,
          },
        );
      if (conversationError) throw new Error("Instagram conversation could not be recorded.");

      const { error: messageError } = await supabase
        .from("instagram_messages")
        .insert({
          id: randomUUID(),
          workspace_id: connection.workspace_id,
          conversation_id: conversationId,
          provider_message_id: event.message.mid,
          direction: "inbound",
          message_text: event.message.text,
          created_at: createdAt,
          delivery_status: "received",
        });
      if (messageError && messageError.code !== "23505") {
        throw new Error("Instagram inbound message could not be recorded.");
      }
      if (!messageError) {
        const { error: latestError } = await supabase
          .from("instagram_conversations")
          .update({
            last_inbound_at: createdAt,
            last_message: event.message.text,
            updated_at: createdAt,
          })
          .eq("workspace_id", connection.workspace_id)
          .eq("id", conversationId)
          .lte("last_inbound_at", createdAt);
        if (latestError) throw new Error("Instagram conversation summary could not be updated.");
      }
    }
  }
}

export function getInstagramWebhookSecret(): string | null {
  return process.env.META_INSTAGRAM_APP_SECRET ?? null;
}
