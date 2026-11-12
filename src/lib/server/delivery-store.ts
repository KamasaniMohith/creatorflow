import "server-only";

import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/server/database";
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
    retryable: Number(row.retryable) === 1,
    attempt: Number(row.attempt),
    createdAt: String(row.created_at),
    sentAt: row.sent_at === null ? null : String(row.sent_at),
    updatedAt: String(row.updated_at),
  };
}

export async function createDeliveryAttempt(input: {
  outreachId: string;
  creatorId: string;
  campaignId: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  retry: boolean;
}): Promise<DeliveryRecord> {
  const database = await getDatabase();
  const transaction = await database.transaction("write");
  try {
    const previousResult = await transaction.execute({
      sql: `SELECT * FROM email_deliveries
            WHERE outreach_id = ? ORDER BY attempt DESC LIMIT 1`,
      args: [input.outreachId],
    });
    const previous = previousResult.rows[0];
    if (previous) {
      const current = toDeliveryRecord(previous as Record<string, unknown>);
      if (
        !input.retry ||
        current.status !== "failed" ||
        !current.retryable
      ) {
        throw new Error("A delivery already exists and is not eligible for a new attempt.");
      }
    } else if (input.retry) {
      throw new Error("There is no failed delivery to retry.");
    }

    const countResult = await transaction.execute({
      sql: `SELECT COUNT(*) AS count FROM email_deliveries
            WHERE created_at >= ?`,
      args: [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
    });
    if (Number(countResult.rows[0]?.count ?? 0) >= 5) {
      throw new Error("The local test-send limit of five emails per 24 hours was reached.");
    }

    const attempt = previous
      ? Number(previous.attempt) + 1
      : 1;
    const now = new Date().toISOString();
    const record: DeliveryRecord = {
      id: randomUUID(),
      outreachId: input.outreachId,
      creatorId: input.creatorId,
      campaignId: input.campaignId,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      body: input.body,
      providerMessageId: null,
      status: "queued",
      errorCode: null,
      errorMessage: null,
      retryable: false,
      attempt,
      createdAt: now,
      sentAt: null,
      updatedAt: now,
    };
    await transaction.execute({
      sql: `INSERT INTO email_deliveries (
        id, outreach_id, creator_id, campaign_id, recipient_email, subject, body,
        provider_message_id, status, error_code, error_message, retryable, attempt,
        idempotency_key, created_at, sent_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'queued', NULL, NULL, 0, ?, ?, ?, NULL, ?)`,
      args: [
        record.id,
        record.outreachId,
        record.creatorId,
        record.campaignId,
        record.recipientEmail,
        record.subject,
        record.body,
        record.attempt,
        `creatorflow:${record.outreachId}:${record.attempt}`,
        now,
        now,
      ],
    });
    await transaction.commit();
    return record;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateDelivery(
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
  const database = await getDatabase();
  await database.execute({
    sql: `UPDATE email_deliveries
          SET provider_message_id = COALESCE(?, provider_message_id),
              status = COALESCE(?, status),
              error_code = ?,
              error_message = ?,
              retryable = COALESCE(?, retryable),
              sent_at = COALESCE(?, sent_at),
              updated_at = ?
          WHERE id = ?`,
    args: [
      updates.providerMessageId ?? null,
      updates.status ?? null,
      updates.errorCode ?? null,
      updates.errorMessage ?? null,
      updates.retryable === undefined ? null : Number(updates.retryable),
      updates.sentAt ?? null,
      new Date().toISOString(),
      id,
    ],
  });
}

export async function getDeliverySummaries(): Promise<DeliveryStatusSummary[]> {
  const database = await getDatabase();
  const result = await database.execute(
    `SELECT outreach_id, status, provider_message_id, error_message,
            retryable, attempt, created_at, sent_at, updated_at
     FROM email_deliveries ORDER BY attempt DESC, updated_at DESC LIMIT 200`,
  );
  return result.rows.map((row) => ({
    outreachId: String(row.outreach_id),
    status: String(row.status) as DeliveryStatus,
    providerMessageId:
      row.provider_message_id === null ? null : String(row.provider_message_id),
    errorMessage: row.error_message === null ? null : String(row.error_message),
    retryable: Number(row.retryable) === 1,
    attempt: Number(row.attempt),
    createdAt: String(row.created_at),
    sentAt: row.sent_at === null ? null : String(row.sent_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function recordResendEvent(
  eventId: string,
  providerMessageId: string,
  status: DeliveryStatus,
): Promise<"updated" | "duplicate" | "unknown"> {
  const database = await getDatabase();
  const transaction = await database.transaction("write");
  try {
    const delivery = await transaction.execute({
      sql: "SELECT id, status FROM email_deliveries WHERE provider_message_id = ?",
      args: [providerMessageId],
    });
    if (!delivery.rows[0]) {
      await transaction.rollback();
      return "unknown";
    }
    const inserted = await transaction.execute({
      sql: "INSERT OR IGNORE INTO resend_webhook_events (event_id, received_at) VALUES (?, ?)",
      args: [eventId, new Date().toISOString()],
    });
    if (inserted.rowsAffected === 0) {
      await transaction.rollback();
      return "duplicate";
    }
    const previousStatus = String(delivery.rows[0].status);
    if (
      previousStatus === "delivered" ||
      previousStatus === "bounced" ||
      ((previousStatus === "failed" || previousStatus === "delivery_delayed") &&
        status === "sent")
    ) {
      await transaction.commit();
      return "updated";
    }
    const errorMessage =
      status === "bounced"
        ? "The recipient mail server rejected the message."
        : status === "failed"
          ? "Resend reported that the message could not be sent."
          : null;
    await transaction.execute({
      sql: `UPDATE email_deliveries
            SET status = ?, error_code = ?, error_message = ?, retryable = 0, updated_at = ?
            WHERE provider_message_id = ?`,
      args: [
        status,
        status === "bounced" ? "recipient_bounced" : status === "failed" ? "provider_failed" : null,
        errorMessage,
        new Date().toISOString(),
        providerMessageId,
      ],
    });
    await transaction.commit();
    return "updated";
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
