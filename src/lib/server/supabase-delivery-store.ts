import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/server/supabase-admin";
import type {
  DeliveryRecord,
  DeliveryStatus,
  DeliveryStatusSummary,
} from "@/types/integrations";

function toDeliveryRecord(row: Record<string, unknown>): DeliveryRecord {
  return {
    id: String(row.id),
    outreachId: String(row.outreach_id),
    creatorId: String(row.creator_id),
    campaignId: row.campaign_id === null ? null : String(row.campaign_id),
    recipientEmail: String(row.recipient_email),
    subject: String(row.subject),
    body: String(row.body),
    providerMessageId:
      row.provider_message_id === null ? null : String(row.provider_message_id),
    status: String(row.status) as DeliveryStatus,
    errorCode: row.error_code === null ? null : String(row.error_code),
    errorMessage: row.error_message === null ? null : String(row.error_message),
    retryable: row.retryable === true,
    attempt: Number(row.attempt),
    createdAt: String(row.created_at),
    sentAt: row.sent_at === null ? null : String(row.sent_at),
    updatedAt: String(row.updated_at),
  };
}

export async function createWorkspaceDeliveryAttempt(input: {
  workspaceId: string;
  userId: string;
  outreachId: string;
  creatorId: string;
  campaignId: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  retry: boolean;
}): Promise<DeliveryRecord> {
  const supabase = createAdminClient();
  const { data: previousRows, error: previousError } = await supabase
    .from("email_delivery_attempts")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("outreach_id", input.outreachId)
    .order("attempt", { ascending: false })
    .limit(1);
  if (previousError) throw new Error("Unable to check prior email delivery attempts.");

  const previous = previousRows?.[0]
    ? toDeliveryRecord(previousRows[0] as Record<string, unknown>)
    : null;
  if (previous) {
    if (!input.retry || previous.status !== "failed" || !previous.retryable) {
      throw new Error("A delivery already exists and is not eligible for a new attempt.");
    }
  } else if (input.retry) {
    throw new Error("There is no failed delivery to retry.");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("email_delivery_attempts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", input.workspaceId)
    .gte("created_at", since);
  if (countError) throw new Error("Unable to check the workspace test-send limit.");
  if ((count ?? 0) >= 5) {
    throw new Error("The workspace test-send limit of five emails per 24 hours was reached.");
  }

  const attempt = previous ? previous.attempt + 1 : 1;
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    workspace_id: input.workspaceId,
    outreach_id: input.outreachId,
    creator_id: input.creatorId,
    campaign_id: input.campaignId,
    recipient_email: input.recipientEmail,
    subject: input.subject,
    body: input.body,
    provider_message_id: null,
    status: "queued",
    error_code: null,
    error_message: null,
    retryable: false,
    attempt,
    idempotency_key: `creatorflow:${input.outreachId}:${attempt}`,
    created_by: input.userId,
    created_at: now,
    sent_at: null,
  };
  const { data, error } = await supabase
    .from("email_delivery_attempts")
    .insert(row)
    .select("*")
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("Another delivery attempt was created concurrently. Refresh before retrying.");
    }
    console.error("Unable to create the workspace email delivery record.", error);
    throw new Error("The delivery could not be recorded.");
  }
  return toDeliveryRecord(data as Record<string, unknown>);
}

export async function updateWorkspaceDelivery(
  workspaceId: string,
  id: string,
  updates: {
    providerMessageId?: string | null;
    status?: DeliveryStatus;
    errorCode?: string | null;
    errorMessage?: string | null;
    retryable?: boolean;
    sentAt?: string | null;
  },
): Promise<void> {
  const values: Record<string, unknown> = {};
  if (updates.providerMessageId !== undefined) {
    values.provider_message_id = updates.providerMessageId;
  }
  if (updates.status !== undefined) values.status = updates.status;
  if (updates.errorCode !== undefined) values.error_code = updates.errorCode;
  if (updates.errorMessage !== undefined) values.error_message = updates.errorMessage;
  if (updates.retryable !== undefined) values.retryable = updates.retryable;
  if (updates.sentAt !== undefined) values.sent_at = updates.sentAt;
  const { data, error } = await createAdminClient()
    .from("email_delivery_attempts")
    .update(values)
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select("id");
  if (error || !data?.length) {
    console.error("Unable to update the workspace email delivery record.", error);
    throw new Error("The email delivery status could not be updated.");
  }
}

export async function getWorkspaceDeliverySummaries(
  workspaceId: string,
): Promise<DeliveryStatusSummary[]> {
  const { data, error } = await createAdminClient()
    .from("email_delivery_attempts")
    .select(
      "outreach_id, status, provider_message_id, error_message, retryable, attempt, created_at, sent_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Unable to load workspace email delivery summaries.", error);
    throw new Error("Email delivery history could not be loaded.");
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    outreachId: String(row.outreach_id),
    status: String(row.status) as DeliveryStatus,
    providerMessageId:
      row.provider_message_id === null ? null : String(row.provider_message_id),
    errorMessage: row.error_message === null ? null : String(row.error_message),
    retryable: row.retryable === true,
    attempt: Number(row.attempt),
    createdAt: String(row.created_at),
    sentAt: row.sent_at === null ? null : String(row.sent_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function recordWorkspaceResendEvent(
  eventId: string,
  providerMessageId: string,
  status: DeliveryStatus,
  eventType: string,
  eventTimestamp: string | null,
): Promise<"updated" | "duplicate" | "unknown"> {
  const supabase = createAdminClient();
  const { data: delivery, error: lookupError } = await supabase
    .from("email_delivery_attempts")
    .select("id, workspace_id, status")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();
  if (lookupError) {
    console.error("Unable to resolve Resend webhook delivery.", lookupError);
    throw new Error("The delivery record could not be resolved.");
  }
  if (!delivery) return "unknown";

  const { data: existingEvent, error: eventLookupError } = await supabase
    .from("email_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();
  if (eventLookupError) throw new Error("Unable to check Resend webhook idempotency.");
  const duplicate = Boolean(existingEvent);
  if (!duplicate) {
    const { error: insertError } = await supabase.from("email_webhook_events").insert({
      workspace_id: delivery.workspace_id,
      event_id: eventId,
      delivery_attempt_id: delivery.id,
      provider: "resend",
      provider_message_id: providerMessageId,
      event_type: eventType,
      event_timestamp: eventTimestamp,
    });
    if (insertError && insertError.code !== "23505") {
      console.error("Unable to store Resend webhook event.", insertError);
      throw new Error("The webhook event could not be recorded.");
    }
  }

  const previousStatus = String(delivery.status);
  const terminal = previousStatus === "delivered" || previousStatus === "bounced";
  const staleSent =
    (previousStatus === "failed" || previousStatus === "delivery_delayed") &&
    status === "sent";
  if (!terminal && !staleSent) {
    const { error: updateError } = await supabase
      .from("email_delivery_attempts")
      .update({
        status,
        error_code:
          status === "bounced"
            ? "recipient_bounced"
            : status === "failed"
              ? "provider_failed"
              : null,
        error_message:
          status === "bounced"
            ? "The recipient mail server rejected the message."
            : status === "failed"
              ? "Resend reported that the message could not be sent."
              : null,
        retryable: false,
      })
      .eq("workspace_id", delivery.workspace_id)
      .eq("id", delivery.id);
    if (updateError) {
      console.error("Unable to apply Resend webhook delivery status.", updateError);
      throw new Error("The delivery status could not be updated.");
    }
  }
  return duplicate ? "duplicate" : "updated";
}
