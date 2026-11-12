import { NextRequest, NextResponse } from "next/server";
import { authorizeApiWorkspace } from "@/lib/server/api-workspace";
import {
  completeWorkspaceInstagramAuthorization,
  instagramOAuthCookieName,
  verifyInstagramOAuthCookie,
} from "@/lib/server/supabase-instagram-service";

function outreachRedirect(request: NextRequest, status: string) {
  const redirectUri = process.env.META_INSTAGRAM_REDIRECT_URI;
  const baseUrl = redirectUri ? new URL(redirectUri) : new URL(request.url);
  const destination = new URL("/outreach", baseUrl);
  destination.searchParams.set("instagram", status);
  const response = NextResponse.redirect(destination);
  response.cookies.set(instagramOAuthCookieName(), "", {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/instagram/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookie = request.cookies.get(instagramOAuthCookieName())?.value;
  try {
    const oauthState = verifyInstagramOAuthCookie(cookie, state);
    if (!oauthState || !code) return outreachRedirect(request, "connection-failed");
    const authorization = await authorizeApiWorkspace(
      oauthState.workspaceId,
      ["owner", "admin"],
    );
    if (!authorization.ok || authorization.userId !== oauthState.userId) {
      return outreachRedirect(request, "connection-failed");
    }
    await completeWorkspaceInstagramAuthorization(
      code.replace(/#_$/, ""),
      state!,
      cookie,
      oauthState.workspaceId,
      authorization.userId,
    );
    return outreachRedirect(request, "connected");
  } catch (error) {
    console.error(
      "Workspace Instagram OAuth callback failed.",
      error instanceof Error ? error.name : "UnknownError",
    );
    return outreachRedirect(request, "connection-failed");
  }
}
