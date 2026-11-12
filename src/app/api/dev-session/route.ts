import { NextRequest, NextResponse } from "next/server";
import {
  accessCookieName,
  canUnlockDevelopmentAccess,
  devTokenMatches,
  isLocalDevelopmentRequest,
} from "@/lib/server/dev-access";

export async function POST(request: NextRequest) {
  if (!canUnlockDevelopmentAccess(request)) {
    return NextResponse.json({ error: "Local development access is disabled." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("accessCode" in body) ||
    !devTokenMatches(body.accessCode)
  ) {
    return NextResponse.json({ error: "The development access code is invalid." }, { status: 401 });
  }

  const response = NextResponse.json({ unlocked: true });
  response.cookies.set(accessCookieName(), body.accessCode, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isLocalDevelopmentRequest(request)) {
    return NextResponse.json({ error: "Local development access is disabled." }, { status: 403 });
  }
  const response = NextResponse.json({ unlocked: false });
  response.cookies.delete(accessCookieName());
  return response;
}
