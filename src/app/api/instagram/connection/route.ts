import { NextRequest, NextResponse } from "next/server";
import { authorizeApiWorkspace } from "@/lib/server/api-workspace";
import { disconnectWorkspaceInstagram } from "@/lib/server/supabase-instagram-service";

export async function DELETE(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const workspaceId =
    typeof body === "object" && body !== null && "workspaceId" in body
      ? body.workspaceId
      : null;
  const authorization = await authorizeApiWorkspace(workspaceId, ["owner", "admin"]);
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }
  try {
    await disconnectWorkspaceInstagram(authorization.workspaceId);
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Instagram account could not be disconnected." },
      { status: 503 },
    );
  }
}
