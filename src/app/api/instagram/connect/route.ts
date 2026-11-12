import { NextRequest, NextResponse } from "next/server";
import { authorizeApiWorkspace } from "@/lib/server/api-workspace";
import {
  beginWorkspaceInstagramAuthorization,
  instagramOAuthCookieName,
} from "@/lib/server/supabase-instagram-service";

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
    const result = await beginWorkspaceInstagramAuthorization(
      authorization.workspaceId,
      authorization.userId,
    );
    const response = NextResponse.json({
      authorizationUrl: result.authorizationUrl,
    });
    response.cookies.set(
      instagramOAuthCookieName(),
      result.cookieValue,
      {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/api/instagram/callback",
        maxAge: 600,
      },
    );
    return response;
  } catch (error) {
    console.error("Unable to start workspace Instagram authorization.", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Instagram setup is incomplete." },
      { status: 503 },
    );
  }
}
