import { NextRequest, NextResponse } from "next/server";
import { authorizeApiWorkspace } from "@/lib/server/api-workspace";
import { sendWorkspaceInstagramReply } from "@/lib/server/supabase-instagram-service";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid reply request." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (
    typeof input.workspaceId !== "string" ||
    typeof input.conversationId !== "string" ||
    !/^[\w-]{1,128}$/.test(input.conversationId) ||
    typeof input.requestId !== "string" ||
    !/^[\w-]{1,128}$/.test(input.requestId) ||
    typeof input.text !== "string" ||
    input.text.trim().length === 0 ||
    input.text.length > 1000 ||
    input.approved !== true
  ) {
    return NextResponse.json({ error: "Approve a valid Instagram reply before sending." }, { status: 400 });
  }
  const authorization = await authorizeApiWorkspace(input.workspaceId);
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }
  try {
    const result = await sendWorkspaceInstagramReply(
      authorization.workspaceId,
      input.conversationId,
      input.text.trim(),
      input.requestId,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Instagram reply could not be sent." },
      { status: 409 },
    );
  }
}
