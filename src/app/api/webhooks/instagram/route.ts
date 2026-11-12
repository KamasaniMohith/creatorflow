import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getInstagramWebhookSecret,
  storeWorkspaceInstagramWebhook,
} from "@/lib/server/supabase-instagram-service";

function constantTimeMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const params = request.nextUrl.searchParams;
  const provided = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  if (
    params.get("hub.mode") !== "subscribe" ||
    !verifyToken ||
    !challenge ||
    !constantTimeMatch(provided, verifyToken)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest) {
  const appSecret = getInstagramWebhookSecret();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!appSecret || !/^sha256=[a-f\d]{64}$/i.test(signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  const body = await request.text();
  if (body.length > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  const expected = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
  if (!constantTimeMatch(signature.toLowerCase(), expected.toLowerCase())) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("object" in payload) ||
    payload.object !== "instagram" ||
    !("entry" in payload) ||
    !Array.isArray(payload.entry)
  ) {
    return NextResponse.json({ error: "Unsupported Instagram webhook payload." }, { status: 400 });
  }
  try {
    await storeWorkspaceInstagramWebhook(payload);
  } catch {
    console.error("Instagram webhook processing failed.");
    return NextResponse.json({ error: "Webhook processing failed; Meta may retry." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
