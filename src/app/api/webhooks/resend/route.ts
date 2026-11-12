import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { recordWorkspaceResendEvent } from "@/lib/server/supabase-delivery-store";
import type { DeliveryStatus } from "@/types/integrations";

const EVENT_STATUS: Record<string, DeliveryStatus | undefined> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.failed": "failed",
  "email.bounced": "bounced",
  "email.suppressed": "failed",
};

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook verification is not configured." }, { status: 503 });
  }

  const payload = await request.text();
  if (payload.length > 1024 * 1024) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }

  const eventId = request.headers.get("svix-id");
  let verified: ReturnType<Resend["webhooks"]["verify"]>;
  try {
    verified = new Resend().webhooks.verify({
      payload,
      headers: {
        id: eventId ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    });
  } catch {
    return NextResponse.json({ error: "Webhook signature or payload is invalid." }, { status: 400 });
  }

  const status = EVENT_STATUS[verified.type];
  const data = verified.data as { email_id?: unknown; created_at?: unknown };
  if (!eventId || !status || typeof data.email_id !== "string") {
    return NextResponse.json({ received: true, ignored: true });
  }
  let result: "updated" | "duplicate" | "unknown";
  try {
    result = await recordWorkspaceResendEvent(
      eventId,
      data.email_id,
      status,
      verified.type,
      typeof data.created_at === "string" ? data.created_at : null,
    );
  } catch (error) {
    console.error("Unable to persist the verified Resend webhook.", error);
    return NextResponse.json({ error: "Webhook event could not be recorded." }, { status: 503 });
  }
  if (result === "unknown") {
    return NextResponse.json({ error: "Delivery record not found yet." }, { status: 503 });
  }
  return NextResponse.json({ received: true, duplicate: result === "duplicate" });
}
