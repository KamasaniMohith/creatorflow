import { NextRequest, NextResponse } from "next/server";
import { authorizeApiWorkspace } from "@/lib/server/api-workspace";
import { listWorkspaceInstagramConversations } from "@/lib/server/supabase-instagram-service";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiWorkspace(
    request.nextUrl.searchParams.get("workspaceId"),
    ["owner", "admin", "member", "viewer"],
  );
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }
  try {
    const conversations = await listWorkspaceInstagramConversations(
      authorization.workspaceId,
    );
    return NextResponse.json(
      { conversations },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load Instagram conversations.", error);
    return NextResponse.json(
      { error: "Instagram conversations could not be loaded." },
      { status: 503 },
    );
  }
}
