import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceDeliverySummaries } from "@/lib/server/supabase-delivery-store";
import { authorizeApiWorkspace } from "@/lib/server/api-workspace";

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
  const deliveries = await getWorkspaceDeliverySummaries(authorization.workspaceId);
  return NextResponse.json({ deliveries }, { headers: { "Cache-Control": "no-store" } });
}
